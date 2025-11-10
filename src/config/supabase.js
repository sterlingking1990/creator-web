import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise fall back to hardcoded values
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pmquvzmgokmavmyotgsv.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcXV2em1nb2ttYXZteW90Z3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxODc1OTksImV4cCI6MjA3NTc2MzU5OX0.fmAtl4mnAaV_onj24BKPcPDfj1-0RBo1ikYWuqxKIus';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});