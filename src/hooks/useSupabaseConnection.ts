import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabaseConnection() {
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    // Try a simple query to test connection
    supabase
      .from('employees')
      .select('id')
      .limit(1)
      .then(({ error }) => {
        if (error) setStatus('disconnected');
        else setStatus('connected');
      });
  }, []);

  return { status, client: supabase };
} 