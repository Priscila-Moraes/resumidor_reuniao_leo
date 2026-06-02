import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fnjivgsmbaxssuutacpq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaml2Z3NtYmF4c3N1dXRhY3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTcwMjQsImV4cCI6MjA5MjIzMzAyNH0.DGSTXEZdkynyrldrpP2S3Seye0GvAsR7102oRf0e1ck';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
