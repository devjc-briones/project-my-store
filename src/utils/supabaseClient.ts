import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};
const rawUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const rawKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

export const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
export const supabaseAnonKey = typeof rawKey === 'string' ? rawKey.trim() : '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseUrl.startsWith('https://') &&
    supabaseAnonKey &&
    supabaseAnonKey.length > 10
);

export function getSupabaseConfigStatus(): { configured: boolean; reason?: string } {
  if (!supabaseUrl && !supabaseAnonKey) {
    return {
      configured: false,
      reason:
        'Hindi nakakonekta sa Supabase database: Walang natagpuang VITE_SUPABASE_URL at VITE_SUPABASE_ANON_KEY sa environment variables. Pakisuri ang Vercel Environment Variables at mag-redeploy ng bagong deployment.',
    };
  }
  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    return {
      configured: false,
      reason:
        'Hindi nakakonekta sa database: Invalid ang Supabase URL. Kailangang magsimula ito sa "https://" mula sa Supabase Project Settings > API.',
    };
  }
  if (!supabaseAnonKey || supabaseAnonKey.length < 10) {
    return {
      configured: false,
      reason:
        'Hindi nakakonekta sa database: Invalid ang Supabase Anon Key. Pakisuri ang anon public key sa Supabase Project Settings > API.',
    };
  }
  return { configured: true };
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cachedClient) return cachedClient;
  try {
    cachedClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
