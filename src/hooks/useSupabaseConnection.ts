import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabaseConnection() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastPing, setLastPing] = useState<Date | null>(null);

  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const checkConnection = async () => {
      try {
        setStatus('connecting');
        const { error } = await supabase
          .from('employees')
          .select('id')
          .limit(1);
        
        if (error) {
          console.error('Connection check failed:', error);
          setStatus('disconnected');
          // Try to reconnect after 5 seconds
          reconnectTimeout = setTimeout(checkConnection, 5000);
        } else {
          setStatus('connected');
          setLastPing(new Date());
        }
      } catch (err) {
        console.error('Connection check error:', err);
        setStatus('disconnected');
        // Try to reconnect after 5 seconds
        reconnectTimeout = setTimeout(checkConnection, 5000);
      }
    };

    // Initial connection check
    checkConnection();

    // Set up periodic ping every 30 seconds
    pingInterval = setInterval(checkConnection, 30000);

    // Cleanup
    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return { 
    status, 
    client: supabase, 
    lastPing,
    isConnected: status === 'connected'
  };
} 