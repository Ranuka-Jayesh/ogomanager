/**
 * Hybrid Projects Hook with Offline Support
 * Works seamlessly online and offline with automatic sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Project } from '../types';
import { supabase } from '../supabaseClient';
import { useNetworkStatus } from './useNetworkStatus';
import {
  getLocalProjects,
  saveProjectsLocally,
  saveProjectLocally,
  addToSyncQueue,
  markProjectDeleted,
  initOfflineDB,
  getSyncQueueCount,
  deleteLocalProject,
} from '../lib/offlineStore';
import { syncManager } from '../lib/syncManager';
import { realtimeManager } from '../lib/realtimeManager';

// Helper to convert various types to number
const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const p = parseFloat(value);
    return isNaN(p) ? 0 : p;
  }
  return 0;
};

// Parse employee payments from JSONB
const parseEmployeePayments = (data: any): { employeeId: string; payment: number }[] => {
  if (!data) return [];
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) return data;
  return [];
};

// Map database row to Project object
const mapProjectFromDB = (project: any): Project => ({
  id: project.id,
  projectId: project.project_id,
  clientName: project.client_name,
  clientUniOrg: project.client_uni_org,
  projectDescription: project.project_description,
  deadlineDate: project.deadline_date,
  price: toNumber(project.price),
  advance: toNumber(project.advance),
  balance: toNumber(project.balance),
  assignedTo: project.assigned_to || '',
  paymentOfEmp: toNumber(project.payment_of_emp),
  employeePayments: parseEmployeePayments(project.employee_payments),
  status: project.status,
  fastDeliver: project.fast_deliver || false,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
});

// Map Project object to database row
const mapProjectToDB = (project: Omit<Project, 'id'>) => ({
  project_id: project.projectId,
  client_name: project.clientName,
  client_uni_org: project.clientUniOrg,
  project_description: project.projectDescription,
  deadline_date: project.deadlineDate,
  price: project.price,
  advance: project.advance,
  balance: project.balance,
  assigned_to: project.assignedTo || null,
  payment_of_emp: project.paymentOfEmp,
  employee_payments:
    project.employeePayments && project.employeePayments.length > 0
      ? project.employeePayments
      : [],
  status: project.status,
  fast_deliver: (project as any).fastDeliver || false,
});

export interface UseProjectsOfflineReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  isOnline: boolean;
  pendingChanges: number;
  isSyncing: boolean;
  syncNow: () => Promise<boolean>;
  lastSyncTime: number | null;
}

export const useProjectsOffline = (): UseProjectsOfflineReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  
  const { isOnline } = useNetworkStatus();
  const isInitialized = useRef(false);
  const wasOnline = useRef(isOnline);

  /**
   * Update pending changes count
   */
  const updatePendingCount = useCallback(async () => {
    const count = await getSyncQueueCount();
    setPendingChanges(count);
  }, []);

  /**
   * Load projects - from local first, then sync with remote if online
   */
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Initialize offline DB
      await initOfflineDB();

      // Always load from local first (instant UI)
      const localProjects = await getLocalProjects();
      if (localProjects.length > 0) {
        const mappedProjects = localProjects.map(mapProjectFromDB);
        setProjects(mappedProjects);
        console.log(`📦 Loaded ${mappedProjects.length} projects from local storage`);
      }

      // If online, fetch fresh data
      if (navigator.onLine) {
        const { data, error: fetchError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching remote projects:', fetchError);
          // Keep local data if fetch fails
          if (localProjects.length === 0) {
            setError('Failed to fetch projects');
          }
        } else if (data) {
          // Save to local and update state
          await saveProjectsLocally(data);
          const mappedProjects = data.map(mapProjectFromDB);
          setProjects(mappedProjects);
          setLastSyncTime(Date.now());
          console.log(`🌐 Synced ${mappedProjects.length} projects from server`);
        }
      }

      await updatePendingCount();
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [updatePendingCount]);

  /**
   * Add a new project - works offline
   */
  const addProject = async (project: Omit<Project, 'id'>): Promise<void> => {
    try {
      setError(null);
      const projectData = mapProjectToDB(project);
      const tempId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const newProject = {
        ...projectData,
        id: tempId,
        created_at: timestamp,
        updated_at: timestamp,
      };

      // Optimistically add to state
      const mappedProject = mapProjectFromDB(newProject);
      setProjects((prev) => [mappedProject, ...prev]);

      if (navigator.onLine) {
        // Try to sync immediately
        const { data, error: insertError } = await supabase
          .from('projects')
          .insert([projectData])
          .select()
          .single();

        if (insertError) {
          console.error('Failed to sync new project, queuing:', insertError);
          // Queue for later sync
          await addToSyncQueue({
            type: 'create',
            table: 'projects',
            data: newProject,
          });
          await saveProjectLocally(newProject, true);
          await updatePendingCount();
        } else if (data) {
          // Replace temp ID with real ID from server
          await deleteLocalProject(tempId);
          await saveProjectLocally(data);
          setProjects((prev) =>
            prev.map((p) => (p.id === tempId ? mapProjectFromDB(data) : p))
          );
          console.log('✅ Project created and synced');
        }
      } else {
        // Save locally and queue for sync
        await saveProjectLocally(newProject, true);
        await addToSyncQueue({
          type: 'create',
          table: 'projects',
          data: newProject,
        });
        await updatePendingCount();
        console.log('📴 Project saved locally (offline)');
      }
    } catch (err) {
      console.error('Error adding project:', err);
      setError('Failed to add project');
    }
  };

  /**
   * Update a project - works offline
   */
  const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
    try {
      setError(null);

      // Find current project
      const currentProject = projects.find((p) => p.id === id);
      if (!currentProject) {
        console.error('Project not found:', id);
        return;
      }

      // Build update data for database
      const updateData: any = {};
      if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
      if (updates.clientName !== undefined) updateData.client_name = updates.clientName;
      if (updates.clientUniOrg !== undefined) updateData.client_uni_org = updates.clientUniOrg;
      if (updates.projectDescription !== undefined) updateData.project_description = updates.projectDescription;
      if (updates.deadlineDate !== undefined) updateData.deadline_date = updates.deadlineDate;
      if (updates.price !== undefined) updateData.price = updates.price;
      if (updates.advance !== undefined) updateData.advance = updates.advance;
      if (updates.balance !== undefined && updates.balance !== null) updateData.balance = updates.balance;
      if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo || null;
      if (updates.paymentOfEmp !== undefined) updateData.payment_of_emp = updates.paymentOfEmp;
      if (updates.employeePayments !== undefined) {
        updateData.employee_payments = updates.employeePayments?.length
          ? updates.employeePayments
          : [];
      }
      if (updates.status !== undefined) updateData.status = updates.status;
      if ((updates as any).fastDeliver !== undefined) updateData.fast_deliver = (updates as any).fastDeliver;

      // Optimistically update state
      const updatedProject = {
        ...currentProject,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? updatedProject : p))
      );

      if (navigator.onLine) {
        const { data, error: updateError } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to sync update, queuing:', updateError);
          await addToSyncQueue({
            type: 'update',
            table: 'projects',
            data: { id, ...updateData },
          });
          await saveProjectLocally({ ...currentProject, ...updateData, id });
          await updatePendingCount();
        } else if (data) {
          await saveProjectLocally(data);
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? mapProjectFromDB(data) : p))
          );
          console.log('✅ Project updated and synced');
        }
      } else {
        // Save locally and queue
        await saveProjectLocally({ ...currentProject, ...updateData, id });
        await addToSyncQueue({
          type: 'update',
          table: 'projects',
          data: { id, ...updateData },
        });
        await updatePendingCount();
        console.log('📴 Project update saved locally (offline)');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      setError('Failed to update project');
    }
  };

  /**
   * Delete a project - works offline
   */
  const deleteProject = async (id: string): Promise<void> => {
    try {
      setError(null);

      // Optimistically remove from state
      setProjects((prev) => prev.filter((p) => p.id !== id));

      if (navigator.onLine) {
        const { error: deleteError } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);

        if (deleteError) {
          console.error('Failed to sync delete, queuing:', deleteError);
          await markProjectDeleted(id);
          await addToSyncQueue({
            type: 'delete',
            table: 'projects',
            data: { id },
          });
          await updatePendingCount();
        } else {
          await deleteLocalProject(id);
          console.log('✅ Project deleted and synced');
        }
      } else {
        // Mark as deleted and queue
        await markProjectDeleted(id);
        await addToSyncQueue({
          type: 'delete',
          table: 'projects',
          data: { id },
        });
        await updatePendingCount();
        console.log('📴 Project delete queued (offline)');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project');
    }
  };

  /**
   * Manual sync trigger
   */
  const syncNow = async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const result = await syncManager.syncAll();
      if (result) {
        await loadProjects();
        setLastSyncTime(Date.now());
      }
      return result;
    } finally {
      setIsSyncing(false);
      await updatePendingCount();
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadProjects();

      // Initialize realtime
      if (navigator.onLine) {
        realtimeManager.initialize();
      }

      // Start periodic sync
      syncManager.startPeriodicSync();
    }

    // Subscribe to realtime changes
    const unsubscribe = realtimeManager.subscribeToProjects((event) => {
      console.log('📡 Realtime project update:', event.eventType);
      // Reload to get latest data
      loadProjects();
    });

    // Subscribe to sync events
    const unsubscribeSync = syncManager.subscribe((event) => {
      if (event.type === 'sync-start') {
        setIsSyncing(true);
      } else if (event.type === 'sync-complete' || event.type === 'sync-error') {
        setIsSyncing(false);
        updatePendingCount();
        if (event.type === 'sync-complete') {
          setLastSyncTime(Date.now());
        }
      } else if (event.type === 'data-updated') {
        loadProjects();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSync();
    };
  }, [loadProjects, updatePendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && !wasOnline.current && pendingChanges > 0) {
      console.log('🌐 Back online with pending changes, syncing...');
      syncNow();
    }
    wasOnline.current = isOnline;

    // Initialize realtime when coming online
    if (isOnline && !realtimeManager.isConnected()) {
      realtimeManager.initialize();
    }
  }, [isOnline, pendingChanges]);

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    refetch: loadProjects,
    isOnline,
    pendingChanges,
    isSyncing,
    syncNow,
    lastSyncTime,
  };
};
