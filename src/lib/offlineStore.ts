/**
 * Offline Storage Layer using IndexedDB
 * Provides persistent local storage for projects and employees
 * with a sync queue for pending operations
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, Employee } from '../types';

// Define sync operation types
export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: 'projects' | 'employees' | 'project_types';
  data: any;
  timestamp: number;
  retryCount: number;
}

// Project Type interface
export interface LocalProjectType {
  id: string;
  name: string;
  created_at?: string;
  _localOnly?: boolean;
  _deleted?: boolean;
  _syncStatus?: 'synced' | 'pending' | 'error';
}

// Extended types for local storage
export interface LocalProject extends Project {
  _localOnly?: boolean;
  _deleted?: boolean;
  _syncStatus?: 'synced' | 'pending' | 'error';
}

export interface LocalEmployee extends Employee {
  _localOnly?: boolean;
  _deleted?: boolean;
  _syncStatus?: 'synced' | 'pending' | 'error';
}

// IndexedDB Schema
interface OfflineDB extends DBSchema {
  projects: {
    key: string;
    value: LocalProject;
    indexes: { 'by-updated': string; 'by-status': string };
  };
  employees: {
    key: string;
    value: LocalEmployee;
    indexes: { 'by-created': string };
  };
  project_types: {
    key: string;
    value: LocalProjectType;
    indexes: { 'by-name': string };
  };
  syncQueue: {
    key: string;
    value: SyncOperation;
    indexes: { 'by-timestamp': number; 'by-table': string };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      lastSync: number;
      version: number;
      lastError?: string;
    };
  };
}

const DB_NAME = 'ogo-manager-offline';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

/**
 * Initialize the offline database
 */
export async function initOfflineDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-updated', 'updatedAt');
          projectStore.createIndex('by-status', 'status');
        }

        // Employees store
        if (!db.objectStoreNames.contains('employees')) {
          const employeeStore = db.createObjectStore('employees', { keyPath: 'id' });
          employeeStore.createIndex('by-created', 'createdAt');
        }

        // Project Types store
        if (!db.objectStoreNames.contains('project_types')) {
          const projectTypesStore = db.createObjectStore('project_types', { keyPath: 'id' });
          projectTypesStore.createIndex('by-name', 'name');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-timestamp', 'timestamp');
          syncStore.createIndex('by-table', 'table');
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      },
      blocked() {
        console.warn('IndexedDB blocked - please close other tabs');
      },
      blocking() {
        console.warn('IndexedDB blocking - closing connection');
        dbInstance?.close();
        dbInstance = null;
      },
    });

    console.log('IndexedDB initialized successfully');
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw error;
  }
}

/**
 * Get database instance (initializes if needed)
 */
export async function getOfflineDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbInstance) {
    await initOfflineDB();
  }
  return dbInstance!;
}

// ==================== PROJECTS ====================

/**
 * Save multiple projects to local storage
 */
export async function saveProjectsLocally(projects: any[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('projects', 'readwrite');
  
  try {
    await Promise.all([
      ...projects.map((project) =>
        tx.store.put({
          ...project,
          _syncStatus: 'synced',
          _localOnly: false,
          _deleted: false,
        })
      ),
      tx.done,
    ]);
    console.log(`Saved ${projects.length} projects locally`);
  } catch (error) {
    console.error('Error saving projects locally:', error);
    throw error;
  }
}

/**
 * Save a single project locally
 */
export async function saveProjectLocally(
  project: any,
  isLocalOnly = false
): Promise<void> {
  const db = await getOfflineDB();
  await db.put('projects', {
    ...project,
    _localOnly: isLocalOnly,
    _syncStatus: isLocalOnly ? 'pending' : 'synced',
    _deleted: false,
  });
}

/**
 * Get all local projects (excluding deleted)
 */
export async function getLocalProjects(): Promise<LocalProject[]> {
  const db = await getOfflineDB();
  const all = await db.getAll('projects');
  return all.filter((p) => !p._deleted);
}

/**
 * Get a single project by ID
 */
export async function getLocalProject(id: string): Promise<LocalProject | undefined> {
  const db = await getOfflineDB();
  return db.get('projects', id);
}

/**
 * Mark a project as deleted (soft delete for sync)
 */
export async function markProjectDeleted(id: string): Promise<void> {
  const db = await getOfflineDB();
  const project = await db.get('projects', id);
  if (project) {
    await db.put('projects', { ...project, _deleted: true });
  }
}

/**
 * Permanently delete a project from local storage
 */
export async function deleteLocalProject(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('projects', id);
}

// ==================== EMPLOYEES ====================

/**
 * Save multiple employees to local storage
 */
export async function saveEmployeesLocally(employees: any[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('employees', 'readwrite');

  try {
    await Promise.all([
      ...employees.map((employee) =>
        tx.store.put({
          ...employee,
          _syncStatus: 'synced',
          _localOnly: false,
          _deleted: false,
        })
      ),
      tx.done,
    ]);
    console.log(`Saved ${employees.length} employees locally`);
  } catch (error) {
    console.error('Error saving employees locally:', error);
    throw error;
  }
}

/**
 * Save a single employee locally
 */
export async function saveEmployeeLocally(
  employee: any,
  isLocalOnly = false
): Promise<void> {
  const db = await getOfflineDB();
  await db.put('employees', {
    ...employee,
    _localOnly: isLocalOnly,
    _syncStatus: isLocalOnly ? 'pending' : 'synced',
    _deleted: false,
  });
}

/**
 * Get all local employees (excluding deleted)
 */
export async function getLocalEmployees(): Promise<LocalEmployee[]> {
  const db = await getOfflineDB();
  const all = await db.getAll('employees');
  return all.filter((e) => !e._deleted);
}

/**
 * Mark an employee as deleted
 */
export async function markEmployeeDeleted(id: string): Promise<void> {
  const db = await getOfflineDB();
  const employee = await db.get('employees', id);
  if (employee) {
    await db.put('employees', { ...employee, _deleted: true });
  }
}

// ==================== PROJECT TYPES ====================

/**
 * Save multiple project types to local storage
 */
export async function saveProjectTypesLocally(types: any[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('project_types', 'readwrite');

  try {
    await Promise.all([
      ...types.map((type) =>
        tx.store.put({
          ...type,
          _syncStatus: 'synced',
          _localOnly: false,
          _deleted: false,
        })
      ),
      tx.done,
    ]);
    console.log(`Saved ${types.length} project types locally`);
  } catch (error) {
    console.error('Error saving project types locally:', error);
    throw error;
  }
}

/**
 * Save a single project type locally
 */
export async function saveProjectTypeLocally(
  type: any,
  isLocalOnly = false
): Promise<void> {
  const db = await getOfflineDB();
  await db.put('project_types', {
    ...type,
    _localOnly: isLocalOnly,
    _syncStatus: isLocalOnly ? 'pending' : 'synced',
    _deleted: false,
  });
}

/**
 * Get all local project types (excluding deleted)
 */
export async function getLocalProjectTypes(): Promise<LocalProjectType[]> {
  const db = await getOfflineDB();
  const all = await db.getAll('project_types');
  return all.filter((t) => !t._deleted);
}

/**
 * Mark a project type as deleted
 */
export async function markProjectTypeDeleted(id: string): Promise<void> {
  const db = await getOfflineDB();
  const type = await db.get('project_types', id);
  if (type) {
    await db.put('project_types', { ...type, _deleted: true });
  }
}

/**
 * Permanently delete a project type from local storage
 */
export async function deleteLocalProjectType(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('project_types', id);
}

// ==================== SYNC QUEUE ====================

/**
 * Add an operation to the sync queue
 */
export async function addToSyncQueue(
  operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>
): Promise<SyncOperation> {
  const db = await getOfflineDB();
  const syncOp: SyncOperation = {
    ...operation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retryCount: 0,
  };
  await db.add('syncQueue', syncOp);
  console.log('Added to sync queue:', syncOp.type, syncOp.table);
  return syncOp;
}

/**
 * Get all pending sync operations (ordered by timestamp)
 */
export async function getSyncQueue(): Promise<SyncOperation[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex('syncQueue', 'by-timestamp');
}

/**
 * Get sync queue count
 */
export async function getSyncQueueCount(): Promise<number> {
  const db = await getOfflineDB();
  return db.count('syncQueue');
}

/**
 * Remove a completed sync operation
 */
export async function removeSyncOperation(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('syncQueue', id);
}

/**
 * Update a sync operation (e.g., increment retry count)
 */
export async function updateSyncOperation(operation: SyncOperation): Promise<void> {
  const db = await getOfflineDB();
  await db.put('syncQueue', operation);
}

/**
 * Clear all sync operations for a table
 */
export async function clearSyncQueueForTable(table: 'projects' | 'employees' | 'project_types'): Promise<void> {
  const db = await getOfflineDB();
  const ops = await db.getAllFromIndex('syncQueue', 'by-table', table);
  const tx = db.transaction('syncQueue', 'readwrite');
  await Promise.all([...ops.map((op) => tx.store.delete(op.id)), tx.done]);
}

// ==================== METADATA ====================

/**
 * Get the last sync timestamp
 */
export async function getLastSyncTime(): Promise<number> {
  const db = await getOfflineDB();
  const meta = await db.get('metadata', 'sync');
  return meta?.lastSync || 0;
}

/**
 * Set the last sync timestamp
 */
export async function setLastSyncTime(timestamp: number): Promise<void> {
  const db = await getOfflineDB();
  const existing = await db.get('metadata', 'sync');
  await db.put('metadata', {
    key: 'sync',
    lastSync: timestamp,
    version: (existing?.version || 0) + 1,
  });
}

/**
 * Store sync error
 */
export async function setSyncError(error: string): Promise<void> {
  const db = await getOfflineDB();
  const existing = await db.get('metadata', 'sync');
  await db.put('metadata', {
    key: 'sync',
    lastSync: existing?.lastSync || 0,
    version: existing?.version || 0,
    lastError: error,
  });
}

// ==================== UTILITIES ====================

/**
 * Clear all local data (use with caution!)
 */
export async function clearAllLocalData(): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction(['projects', 'employees', 'project_types', 'syncQueue', 'metadata'], 'readwrite');
  await Promise.all([
    tx.objectStore('projects').clear(),
    tx.objectStore('employees').clear(),
    tx.objectStore('project_types').clear(),
    tx.objectStore('syncQueue').clear(),
    tx.objectStore('metadata').clear(),
    tx.done,
  ]);
  console.log('All local data cleared');
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  projectCount: number;
  employeeCount: number;
  projectTypeCount: number;
  pendingOps: number;
  lastSync: number;
}> {
  const db = await getOfflineDB();
  const [projectCount, employeeCount, projectTypeCount, pendingOps, lastSync] = await Promise.all([
    db.count('projects'),
    db.count('employees'),
    db.count('project_types'),
    db.count('syncQueue'),
    getLastSyncTime(),
  ]);
  return { projectCount, employeeCount, projectTypeCount, pendingOps, lastSync };
}

/**
 * Check if database is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
