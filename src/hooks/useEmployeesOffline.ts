/**
 * Hybrid Employees Hook with Offline Support
 * Works seamlessly online and offline with automatic sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Employee } from '../types';
import { supabase } from '../supabaseClient';
import { useNetworkStatus } from './useNetworkStatus';
import {
  getLocalEmployees,
  saveEmployeesLocally,
  saveEmployeeLocally,
  addToSyncQueue,
  markEmployeeDeleted,
  initOfflineDB,
  getSyncQueueCount,
  getOfflineDB,
} from '../lib/offlineStore';
import { syncManager } from '../lib/syncManager';
import { realtimeManager } from '../lib/realtimeManager';

// Map database row to Employee object
const mapEmployeeFromDB = (employee: any): Employee => ({
  id: String(employee.id),
  employeeId: employee.employeeId ?? employee.employee_id,
  birthday: employee.birthday ?? '',
  firstName: employee.firstName ?? employee.first_name,
  lastName: employee.lastName ?? employee.last_name,
  position: employee.position ?? '',
  address: employee.address ?? '',
  whatsappNumber: employee.whatsappNumber ?? employee.whatsapp ?? '',
  emailAddress: employee.emailAddress ?? employee.email ?? '',
  qualifications: employee.qualifications ?? '',
  isActive: employee.isActive ?? employee.is_active ?? true,
  showInPerformance: employee.showInPerformance ?? employee.show_in_performance ?? true,
  createdAt: employee.createdAt ?? employee.created_at,
});

// Map Employee object to database row
const mapEmployeeToDB = (employee: Omit<Employee, 'id'>) => ({
  employee_id: employee.employeeId,
  birthday: employee.birthday,
  first_name: employee.firstName,
  last_name: employee.lastName,
  position: employee.position,
  address: employee.address,
  whatsapp: employee.whatsappNumber,
  email: employee.emailAddress,
  qualifications: employee.qualifications,
  is_active: employee.isActive !== false,
  show_in_performance: employee.showInPerformance !== false,
});

export interface UseEmployeesOfflineReturn {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  isOnline: boolean;
  pendingChanges: number;
  isSyncing: boolean;
  syncNow: () => Promise<boolean>;
}

export const useEmployeesOffline = (): UseEmployeesOfflineReturn => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

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
   * Load employees - from local first, then sync with remote if online
   */
  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Initialize offline DB
      await initOfflineDB();

      // Always load from local first (instant UI)
      const localEmployees = await getLocalEmployees();
      if (localEmployees.length > 0) {
        const mappedEmployees = localEmployees.map(mapEmployeeFromDB);
        setEmployees(mappedEmployees);
        console.log(`📦 Loaded ${mappedEmployees.length} employees from local storage`);
      }

      // If online, fetch fresh data
      if (navigator.onLine) {
        const { data, error: fetchError } = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching remote employees:', fetchError);
          if (localEmployees.length === 0) {
            setError('Failed to fetch employees');
          }
        } else if (data) {
          await saveEmployeesLocally(data);
          const mappedEmployees = data.map(mapEmployeeFromDB);
          setEmployees(mappedEmployees);
          console.log(`🌐 Synced ${mappedEmployees.length} employees from server`);
        }
      }

      await updatePendingCount();
    } catch (err) {
      console.error('Error loading employees:', err);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [updatePendingCount]);

  /**
   * Add a new employee - works offline
   */
  const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<void> => {
    try {
      setError(null);
      const employeeData = mapEmployeeToDB(employee);
      const tempId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const newEmployee = {
        ...employeeData,
        id: tempId,
        created_at: timestamp,
      };

      // Optimistically add to state
      const mappedEmployee = mapEmployeeFromDB(newEmployee);
      setEmployees((prev) => [mappedEmployee, ...prev]);

      if (navigator.onLine) {
        const { data, error: insertError } = await supabase
          .from('employees')
          .insert([employeeData])
          .select()
          .single();

        if (insertError) {
          console.error('Failed to sync new employee, queuing:', insertError);
          await addToSyncQueue({
            type: 'create',
            table: 'employees',
            data: newEmployee,
          });
          await saveEmployeeLocally(newEmployee, true);
          await updatePendingCount();
        } else if (data) {
          // Replace temp ID with real ID
          const db = await getOfflineDB();
          await db.delete('employees', tempId);
          await saveEmployeeLocally(data);
          setEmployees((prev) =>
            prev.map((e) => (e.id === tempId ? mapEmployeeFromDB(data) : e))
          );
          console.log('✅ Employee created and synced');
        }
      } else {
        await saveEmployeeLocally(newEmployee, true);
        await addToSyncQueue({
          type: 'create',
          table: 'employees',
          data: newEmployee,
        });
        await updatePendingCount();
        console.log('📴 Employee saved locally (offline)');
      }
    } catch (err) {
      console.error('Error adding employee:', err);
      setError('Failed to add employee');
    }
  };

  /**
   * Update an employee - works offline
   */
  const updateEmployee = async (id: string, updates: Partial<Employee>): Promise<void> => {
    try {
      setError(null);

      const currentEmployee = employees.find((e) => e.id === id);
      if (!currentEmployee) {
        console.error('Employee not found:', id);
        return;
      }

      // Build update data for database
      const updateData: any = {};
      if (updates.employeeId !== undefined) updateData.employee_id = updates.employeeId;
      if (updates.birthday !== undefined) updateData.birthday = updates.birthday;
      if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
      if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
      if (updates.position !== undefined) updateData.position = updates.position;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.whatsappNumber !== undefined) updateData.whatsapp = updates.whatsappNumber;
      if (updates.emailAddress !== undefined) updateData.email = updates.emailAddress;
      if (updates.qualifications !== undefined) updateData.qualifications = updates.qualifications;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.showInPerformance !== undefined) {
        updateData.show_in_performance = updates.showInPerformance;
      }

      // Optimistically update state
      const updatedEmployee = { ...currentEmployee, ...updates };
      setEmployees((prev) =>
        prev.map((e) => (e.id === id ? updatedEmployee : e))
      );

      if (navigator.onLine) {
        const { data, error: updateError } = await supabase
          .from('employees')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to sync update, queuing:', updateError);
          await addToSyncQueue({
            type: 'update',
            table: 'employees',
            data: { id, ...updateData },
          });
          await saveEmployeeLocally({ ...currentEmployee, ...updateData, id });
          await updatePendingCount();
        } else if (data) {
          await saveEmployeeLocally(data);
          setEmployees((prev) =>
            prev.map((e) => (e.id === id ? mapEmployeeFromDB(data) : e))
          );
          console.log('✅ Employee updated and synced');
        }
      } else {
        await saveEmployeeLocally({ ...currentEmployee, ...updateData, id });
        await addToSyncQueue({
          type: 'update',
          table: 'employees',
          data: { id, ...updateData },
        });
        await updatePendingCount();
        console.log('📴 Employee update saved locally (offline)');
      }
    } catch (err) {
      console.error('Error updating employee:', err);
      setError('Failed to update employee');
    }
  };

  /**
   * Delete an employee - works offline
   */
  const deleteEmployee = async (id: string): Promise<void> => {
    try {
      setError(null);

      // Optimistically remove from state
      setEmployees((prev) => prev.filter((e) => e.id !== id));

      if (navigator.onLine) {
        const { error: deleteError } = await supabase
          .from('employees')
          .delete()
          .eq('id', id);

        if (deleteError) {
          console.error('Failed to sync delete, queuing:', deleteError);
          await markEmployeeDeleted(id);
          await addToSyncQueue({
            type: 'delete',
            table: 'employees',
            data: { id },
          });
          await updatePendingCount();
        } else {
          const db = await getOfflineDB();
          await db.delete('employees', id);
          console.log('✅ Employee deleted and synced');
        }
      } else {
        await markEmployeeDeleted(id);
        await addToSyncQueue({
          type: 'delete',
          table: 'employees',
          data: { id },
        });
        await updatePendingCount();
        console.log('📴 Employee delete queued (offline)');
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
      setError('Failed to delete employee');
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
        await loadEmployees();
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
      loadEmployees();

      // Initialize realtime
      if (navigator.onLine) {
        realtimeManager.initialize();
      }
    }

    // Subscribe to realtime changes
    const unsubscribe = realtimeManager.subscribeToEmployees((event) => {
      console.log('📡 Realtime employee update:', event.eventType);
      // Only reload when offline - when online, realtime updates are handled by sync
      if (!navigator.onLine) {
        loadEmployees();
      }
    });

    // Subscribe to sync events
    const unsubscribeSync = syncManager.subscribe((event) => {
      if (event.type === 'sync-start') {
        setIsSyncing(true);
      } else if (event.type === 'sync-complete' || event.type === 'sync-error') {
        setIsSyncing(false);
        updatePendingCount();
        // Don't refresh when online - data is already synced in background
        // Only refresh when offline to get latest from IndexedDB
        if (!navigator.onLine) {
          loadEmployees();
        }
      } else if (event.type === 'data-updated') {
        // Only refresh when offline - when online, hold current data
        if (!navigator.onLine) {
          loadEmployees();
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSync();
    };
  }, [loadEmployees, updatePendingCount]);

  // Auto-sync when coming back online and refresh when going offline
  useEffect(() => {
    // Detect transition from online to offline - refresh data from IndexedDB
    if (!isOnline && wasOnline.current) {
      console.log('📴 Going offline - refreshing from IndexedDB...');
      loadEmployees();
    }

    if (isOnline && !wasOnline.current && pendingChanges > 0) {
      console.log('🌐 Back online with pending changes, syncing...');
      syncNow();
    }
    wasOnline.current = isOnline;

    if (isOnline && !realtimeManager.isConnected()) {
      realtimeManager.initialize();
    }
  }, [isOnline, pendingChanges, loadEmployees]);

  return {
    employees,
    loading,
    error,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    refetch: loadEmployees,
    isOnline,
    pendingChanges,
    isSyncing,
    syncNow,
  };
};
