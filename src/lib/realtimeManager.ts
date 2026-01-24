/**
 * Realtime Manager
 * Handles Supabase Realtime subscriptions for live updates
 */

import { supabase } from '../supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  saveProjectLocally,
  saveEmployeeLocally,
  markProjectDeleted,
  markEmployeeDeleted,
  getOfflineDB,
} from './offlineStore';

export type TableName = 'projects' | 'employees';
export type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeChangeEvent {
  table: TableName;
  eventType: ChangeEventType;
  newData: any | null;
  oldData: any | null;
  timestamp: Date;
}

type RealtimeCallback = (event: RealtimeChangeEvent) => void;

class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private isInitialized = false;
  private projectListeners: Set<RealtimeCallback> = new Set();
  private employeeListeners: Set<RealtimeCallback> = new Set();
  private globalListeners: Set<RealtimeCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Initialize realtime subscriptions
   */
  initialize(): void {
    if (this.isInitialized || this.channel) {
      console.log('🔌 Realtime already initialized');
      return;
    }

    console.log('🔌 Initializing Supabase Realtime...');

    try {
      this.channel = supabase
        .channel('db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          (payload: RealtimePostgresChangesPayload<any>) => {
            this.handleProjectChange(payload);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'employees' },
          (payload: RealtimePostgresChangesPayload<any>) => {
            this.handleEmployeeChange(payload);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime subscribed successfully');
            this.isInitialized = true;
            this.reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Realtime channel error:', err);
            this.handleReconnect();
          } else if (status === 'TIMED_OUT') {
            console.warn('⏰ Realtime subscription timed out');
            this.handleReconnect();
          } else if (status === 'CLOSED') {
            console.log('🔌 Realtime channel closed');
            this.isInitialized = false;
          }
        });
    } catch (error) {
      console.error('Failed to initialize realtime:', error);
      this.handleReconnect();
    }
  }

  /**
   * Handle project table changes
   */
  private async handleProjectChange(
    payload: RealtimePostgresChangesPayload<any>
  ): Promise<void> {
    console.log('📡 Project change received:', payload.eventType);

    const event: RealtimeChangeEvent = {
      table: 'projects',
      eventType: payload.eventType as ChangeEventType,
      newData: payload.new || null,
      oldData: payload.old || null,
      timestamp: new Date(),
    };

    try {
      // Update local IndexedDB
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new) {
          await saveProjectLocally(payload.new as any);
        }
      } else if (payload.eventType === 'DELETE') {
        if (payload.old && payload.old.id) {
          await markProjectDeleted(payload.old.id);
        }
      }
    } catch (error) {
      console.error('Error updating local project data:', error);
    }

    // Notify listeners
    this.projectListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in project listener:', err);
      }
    });

    this.globalListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in global listener:', err);
      }
    });
  }

  /**
   * Handle employee table changes
   */
  private async handleEmployeeChange(
    payload: RealtimePostgresChangesPayload<any>
  ): Promise<void> {
    console.log('📡 Employee change received:', payload.eventType);

    const event: RealtimeChangeEvent = {
      table: 'employees',
      eventType: payload.eventType as ChangeEventType,
      newData: payload.new || null,
      oldData: payload.old || null,
      timestamp: new Date(),
    };

    try {
      // Update local IndexedDB
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new) {
          await saveEmployeeLocally(payload.new as any);
        }
      } else if (payload.eventType === 'DELETE') {
        if (payload.old && payload.old.id) {
          await markEmployeeDeleted(payload.old.id);
        }
      }
    } catch (error) {
      console.error('Error updating local employee data:', error);
    }

    // Notify listeners
    this.employeeListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in employee listener:', err);
      }
    });

    this.globalListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in global listener:', err);
      }
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (navigator.onLine) {
        this.disconnect();
        this.initialize();
      } else {
        console.log('📴 Still offline, waiting...');
        this.handleReconnect();
      }
    }, delay);
  }

  /**
   * Subscribe to project changes
   */
  subscribeToProjects(callback: RealtimeCallback): () => void {
    this.projectListeners.add(callback);
    return () => {
      this.projectListeners.delete(callback);
    };
  }

  /**
   * Subscribe to employee changes
   */
  subscribeToEmployees(callback: RealtimeCallback): () => void {
    this.employeeListeners.add(callback);
    return () => {
      this.employeeListeners.delete(callback);
    };
  }

  /**
   * Subscribe to all changes
   */
  subscribeToAll(callback: RealtimeCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.channel) {
      console.log('🔌 Disconnecting Realtime...');
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if realtime is connected
   */
  isConnected(): boolean {
    return this.isInitialized && this.channel !== null;
  }

  /**
   * Get connection status
   */
  getStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.isInitialized && this.channel) return 'connected';
    if (this.channel && !this.isInitialized) return 'connecting';
    return 'disconnected';
  }
}

// Export singleton instance
export const realtimeManager = new RealtimeManager();
