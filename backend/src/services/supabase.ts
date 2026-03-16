import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase URL or Service Role Key');
}

// Service role client for admin tasks (use with caution)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to get a client context for a specific user token (for RLS)
export const getSupabaseClient = (accessToken: string) => {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
};
