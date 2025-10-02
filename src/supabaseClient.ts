import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sbamvpexzxndiffcfate.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYW12cGV4enhuZGlmZmNmYXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NDEyMzYsImV4cCI6MjA2OTMxNzIzNn0.Z3coSFUFgnWZY2MGpDOKH81kpC-hwgcRxo20gKH1-G0'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 