/**
 * Sync Manager
 * Handles synchronization of offline changes with Supabase
 */

import { supabase } from '../supabaseClient';
import {
  getSyncQueue,
  removeSyncOperation,
  updateSyncOperation,
  saveProjectsLocally,
  saveEmployeesLocally,
  saveProjectTypesLocally,
  setLastSyncTime,
  setSyncError,
  getLastSyncTime,
  SyncOperation,
} from './offlineStore';

const MAX_RETRY_COUNT = 3;
const SYNC_INTERVAL_MS = 30000; // 30 seconds

export type SyncEventType =
  | 'sync-start'
  | 'sync-complete'
  | 'sync-error'
  | 'sync-progress'
  | 'operation-success'
  | 'operation-failed'
  | 'data-updated';

export interface SyncEvent {
  type: SyncEventType;
  data?: any;
  error?: Error | string;
  progress?: {
    completed: number;
    total: number;
  };
}

type SyncEventCallback = (event: SyncEvent) => void;

class SyncManager {
  private listeners: Set<SyncEventCallback> = new Set();
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private lastSyncAttempt: number = 0;

  /**
   * Subscribe to sync events
   */
  subscribe(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: SyncEvent): void {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  /**
   * Check if currently syncing
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Perform full synchronization
   */
  async syncAll(): Promise<boolean> {
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping...');
      return false;
    }

    if (!navigator.onLine) {
      console.log('📴 Offline - cannot sync');
      return false;
    }

    this.isSyncing = true;
    this.lastSyncAttempt = Date.now();
    this.emit({ type: 'sync-start' });

    try {
      // Step 1: Push local changes (process sync queue)
      console.log('📤 Processing sync queue...');
      await this.processSyncQueue();

      // Step 2: Pull remote data
      console.log('📥 Pulling remote data...');
      await this.pullRemoteData();

      // Update last sync time
      await setLastSyncTime(Date.now());

      console.log('✅ Sync completed successfully');
      this.emit({ type: 'sync-complete' });
      return true;
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await setSyncError(errorMessage);
      this.emit({ type: 'sync-error', error: errorMessage });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process all pending operations in the sync queue
   */
  private async processSyncQueue(): Promise<void> {
    const queue = await getSyncQueue();
    
    if (queue.length === 0) {
      console.log('📭 Sync queue is empty');
      return;
    }

    console.log(`📋 Processing ${queue.length} pending operations...`);
    let completed = 0;

    for (const operation of queue) {
      try {
        await this.processOperation(operation);
        await removeSyncOperation(operation.id);
        completed++;
        
        this.emit({
          type: 'operation-success',
          data: operation,
          progress: { completed, total: queue.length },
        });
        
        console.log(`✓ Processed: ${operation.type} ${operation.table}`);
      } catch (error) {
        console.error(`✗ Failed: ${operation.type} ${operation.table}`, error);

        if (operation.retryCount < MAX_RETRY_COUNT) {
          // Increment retry count and keep in queue
          await updateSyncOperation({
            ...operation,
            retryCount: operation.retryCount + 1,
          });
          console.log(`⟳ Will retry (attempt ${operation.retryCount + 1}/${MAX_RETRY_COUNT})`);
        } else {
          // Max retries reached - remove from queue and notify
          await removeSyncOperation(operation.id);
          this.emit({
            type: 'operation-failed',
            data: operation,
            error: error instanceof Error ? error : String(error),
          });
          console.log(`✗ Max retries reached, operation discarded`);
        }
      }
    }

    this.emit({
      type: 'sync-progress',
      progress: { completed, total: queue.length },
    });
  }

  /**
   * Process a single sync operation
   */
  private async processOperation(op: SyncOperation): Promise<void> {
    const { type, table, data } = op;

    switch (type) {
      case 'create': {
        // Remove local-only fields before sending to server
        const { _localOnly, _deleted, _syncStatus, id, ...createData } = data;
        const { error } = await supabase.from(table).insert([createData]);
        if (error) throw error;
        break;
      }

      case 'update': {
        const { id, _localOnly, _deleted, _syncStatus, ...updateData } = data;
        if (!id) throw new Error('Update operation missing id');
        const { error } = await supabase.from(table).update(updateData).eq('id', id);
        if (error) throw error;
        break;
      }

      case 'delete': {
        const { id } = data;
        if (!id) throw new Error('Delete operation missing id');
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        break;
      }

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Pull fresh data from the remote database
   */
  private async pullRemoteData(): Promise<void> {
    // Fetch projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    if (projects && projects.length > 0) {
      await saveProjectsLocally(projects);
      console.log(`📥 Saved ${projects.length} projects locally`);
    }

    // Fetch employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      throw employeesError;
    }

    if (employees && employees.length > 0) {
      await saveEmployeesLocally(employees);
      console.log(`📥 Saved ${employees.length} employees locally`);
    }

    // Fetch project types
    const { data: projectTypes, error: typesError } = await supabase
      .from('project_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (typesError) {
      console.error('Error fetching project types:', typesError);
      // Don't throw - project types are not critical
    }

    if (projectTypes && projectTypes.length > 0) {
      await saveProjectTypesLocally(projectTypes);
      console.log(`📥 Saved ${projectTypes.length} project types locally`);
    }

    this.emit({ type: 'data-updated' });
  }

  /**
   * Start periodic background sync
   */
  startPeriodicSync(intervalMs: number = SYNC_INTERVAL_MS): void {
    if (this.syncInterval) {
      console.log('⏰ Periodic sync already running');
      return;
    }

    console.log(`⏰ Starting periodic sync every ${intervalMs / 1000}s`);
    
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        console.log('⏰ Periodic sync triggered');
        this.syncAll();
      }
    }, intervalMs);
  }

  /**
   * Stop periodic background sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏰ Periodic sync stopped');
    }
  }

  /**
   * Get last sync attempt timestamp
   */
  getLastSyncAttempt(): number {
    return this.lastSyncAttempt;
  }

  /**
   * Force immediate sync (bypasses the "already syncing" check)
   */
  async forceSync(): Promise<boolean> {
    this.isSyncing = false; // Reset flag
    return this.syncAll();
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
