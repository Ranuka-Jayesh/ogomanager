/**
 * Hybrid Projects Hook with Offline Support
 * Works seamlessly online and offline with automatic sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, EmployeePayment } from '../types';
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
import {
  parseEmployeePayments,
  toEmployeePaymentsJson,
  totalEmployeePaymentAmount,
  syncProjectEmployeePayments,
  fetchEmployeePaymentsByProject,
  attachEmployeePaymentsToProjectRows,
} from '../utils/employeePayments';

// Helper to convert various types to number
const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const p = parseFloat(value);
    return isNaN(p) ? 0 : p;
  }
  return 0;
};

const normalizePaymentsList = (payments?: EmployeePayment[]): EmployeePayment[] => {
  if (!payments?.length) return [];
  return parseEmployeePayments(payments);
};

// Map database row to Project object
const mapProjectFromDB = (project: any): Project => {
  const employeePayments = parseEmployeePayments(
    project.employeePayments ?? project.employee_payments
  );
  const paymentOfEmp =
    employeePayments.length > 0
      ? totalEmployeePaymentAmount(employeePayments)
      : Math.abs(toNumber(project.paymentOfEmp ?? project.payment_of_emp));

  return {
    id: String(project.id),
    projectId: project.projectId ?? project.project_id,
    clientName: project.clientName ?? project.client_name,
    clientUniOrg: project.clientUniOrg ?? project.client_uni_org,
    projectDescription: project.projectDescription ?? project.project_description,
    deadlineDate: project.deadlineDate ?? project.deadline_date,
    price: toNumber(project.price),
    advance: toNumber(project.advance),
    balance: toNumber(project.balance),
    assignedTo: project.assignedTo ?? project.assigned_to ?? '',
    paymentOfEmp,
    employeePayments,
    status: project.status,
    fastDeliver: project.fastDeliver ?? project.fast_deliver ?? false,
    giveDiscount: project.giveDiscount ?? project.give_discount ?? false,
    discountAmount: toNumber(project.discountAmount ?? project.discount_amount),
    createdAt: project.createdAt ?? project.created_at,
    updatedAt: project.updatedAt ?? project.updated_at,
  };
};

// Map Project object to database row
const mapProjectToDB = (project: Omit<Project, 'id'>) => {
  const employeePayments = normalizePaymentsList(project.employeePayments);
  const paymentOfEmp =
    employeePayments.length > 0
      ? totalEmployeePaymentAmount(employeePayments)
      : Math.abs(project.paymentOfEmp || 0);

  return {
    project_id: project.projectId,
    client_name: project.clientName,
    client_uni_org: project.clientUniOrg,
    project_description: project.projectDescription,
    deadline_date: project.deadlineDate,
    price: project.price,
    advance: project.advance,
    balance: project.balance,
    assigned_to: project.assignedTo || null,
    payment_of_emp: paymentOfEmp,
    employee_payments: toEmployeePaymentsJson(employeePayments),
    status: project.status,
    fast_deliver: project.fastDeliver || false,
    give_discount: project.giveDiscount || false,
    discount_amount: project.giveDiscount ? (project.discountAmount || 0) : 0,
  };
};

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
          const paymentsByProject = await fetchEmployeePaymentsByProject();
          const enriched = attachEmployeePaymentsToProjectRows(data, paymentsByProject);
          // Save to local and update state
          await saveProjectsLocally(enriched);
          const mappedProjects = enriched.map(mapProjectFromDB);
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
          try {
            await syncProjectEmployeePayments(
              data.id,
              normalizePaymentsList(project.employeePayments)
            );
          } catch (payErr) {
            console.error('Failed to sync employee_payments after create:', payErr);
          }
          const paymentsByProject = await fetchEmployeePaymentsByProject();
          const [enriched] = attachEmployeePaymentsToProjectRows([data], paymentsByProject);
          await saveProjectLocally(enriched);
          setProjects((prev) =>
            prev.map((p) => (p.id === tempId ? mapProjectFromDB(enriched) : p))
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
      if (updates.paymentOfEmp !== undefined || updates.employeePayments !== undefined) {
        const payments = normalizePaymentsList(
          updates.employeePayments ?? currentProject.employeePayments
        );
        updateData.payment_of_emp =
          payments.length > 0
            ? totalEmployeePaymentAmount(payments)
            : Math.abs(updates.paymentOfEmp ?? currentProject.paymentOfEmp ?? 0);
        updateData.employee_payments = toEmployeePaymentsJson(payments);
      }
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.fastDeliver !== undefined) updateData.fast_deliver = updates.fastDeliver;
      if (updates.giveDiscount !== undefined) updateData.give_discount = updates.giveDiscount;
      if (updates.discountAmount !== undefined) {
        updateData.discount_amount = updates.giveDiscount === false ? 0 : updates.discountAmount;
      }

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
          if (updates.employeePayments !== undefined || updates.paymentOfEmp !== undefined) {
            try {
              await syncProjectEmployeePayments(
                id,
                normalizePaymentsList(
                  updates.employeePayments ?? currentProject.employeePayments
                )
              );
            } catch (payErr) {
              console.error('Failed to sync employee_payments after update:', payErr);
            }
          }
          const paymentsByProject = await fetchEmployeePaymentsByProject();
          const [enriched] = attachEmployeePaymentsToProjectRows([data], paymentsByProject);
          await saveProjectLocally(enriched);
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? mapProjectFromDB(enriched) : p))
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
      // Only reload when offline - when online, realtime updates are handled by sync
      if (!navigator.onLine) {
        loadProjects();
      }
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
        // Don't refresh when online - data is already synced in background
        // Only refresh when offline to get latest from IndexedDB
        if (!navigator.onLine) {
          loadProjects();
        }
      } else if (event.type === 'data-updated') {
        // Only refresh when offline - when online, hold current data
        if (!navigator.onLine) {
          loadProjects();
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSync();
    };
  }, [loadProjects, updatePendingCount]);

  // Auto-sync when coming back online and refresh when going offline
  useEffect(() => {
    // Detect transition from online to offline - refresh data from IndexedDB
    if (!isOnline && wasOnline.current) {
      console.log('📴 Going offline - refreshing from IndexedDB...');
      loadProjects();
    }

    if (isOnline && !wasOnline.current && pendingChanges > 0) {
      console.log('🌐 Back online with pending changes, syncing...');
      syncNow();
    }
    wasOnline.current = isOnline;

    // Initialize realtime when coming online
    if (isOnline && !realtimeManager.isConnected()) {
      realtimeManager.initialize();
    }
  }, [isOnline, pendingChanges, loadProjects]);

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
