import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://riskgauandtukcazakpt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpc2tnYXVhbmR0dWtjYXpha3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDI2OTgsImV4cCI6MjA2NjA3ODY5OH0.myyR94MgE0X2aY1I-s2rikjxM1FhwS3w3-3tQtvO3pM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 