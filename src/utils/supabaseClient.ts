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

export function formatAuthError(rawMessage?: string): { message: string; isSystemError: boolean } {
  const raw = (rawMessage || '').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return {
      message: 'Incorrect email or password. Please check your credentials and try again.',
      isSystemError: false,
    };
  }
  if (lower.includes('email not confirmed')) {
    return {
      message: 'Your email address is not confirmed yet. Please check your inbox for the verification link.',
      isSystemError: false,
    };
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('already exists')
  ) {
    return {
      message: 'An account with this email address already exists. Please sign in instead.',
      isSystemError: false,
    };
  }
  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return {
      message: 'Password must be at least 6 characters.',
      isSystemError: false,
    };
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return {
      message: 'Please enter a valid email address.',
      isSystemError: false,
    };
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('for security purposes')
  ) {
    return {
      message: 'Too many attempts. Please wait a moment and try again.',
      isSystemError: false,
    };
  }
  if (lower.includes('new password should be different')) {
    return {
      message: 'Your new password must be different from your previous password.',
      isSystemError: false,
    };
  }
  if (lower.includes('auth session missing')) {
    return {
      message: 'Your session has expired. Please sign in again.',
      isSystemError: false,
    };
  }

  return {
    message: raw ? `Database error: ${raw}` : 'Unable to reach database. Please try again.',
    isSystemError: true,
  };
}

