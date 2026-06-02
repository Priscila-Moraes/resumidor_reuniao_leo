import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ SUPABASE_URL and SUPABASE_ANON_KEY should be provided in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cria um cliente autenticado com o JWT do usuário (respeita RLS com auth.uid())
export const supabaseAs = (token: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
