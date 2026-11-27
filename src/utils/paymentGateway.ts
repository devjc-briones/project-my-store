import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type PaymentGatewayEngine = 'auto_match' | 'paymongo';
export type PaymentSessionStatus = 'awaiting_payment' | 'paid' | 'expired' | 'failed';

export interface PaymentGatewayPublicConfig {
  engine: PaymentGatewayEngine;
  zeroReceiptMode: boolean;
  supportedChannels: string[];
  paymongoConfigured: boolean;
  localWebhookConfigured: boolean;
  supabaseServiceConfigured: boolean;
  supabaseKeyWarning?: string;
  localWebhookPath: string;
  localWebhookUrl: string;
  paymongoWebhookPath: string;
  paymongoWebhookUrl: string;
}

export interface PaymentSessionIntent {
  id: string;
  referenceCode: string;
  readToken?: string;
  targetType: 'subscription' | 'store_order';
  planId?: 'pro' | 'starter';
  storeId?: string;
  channel: string;
  channelLabel: string;
  provider: PaymentGatewayEngine;
  currency: string;
  baseAmount: number;
  uniquePayableAmount: number;
  checkoutUrl?: string;
  status: PaymentSessionStatus;
  matchedAlertReference?: string;
  paidAt?: string;
  expiresAt: string;
  createdAt: string;
}

export interface AdminGatewayActivity {
  intents: PaymentSessionIntent[];
  recentAlerts: Array<{
    id: string;
    provider: string;
    channel?: string;
    amount: number;
    senderName?: string;
    externalReference?: string;
    matchedIntentId?: string;
    receivedAt: string;
  }>;
}

async function getAccessToken(): Promise<string | undefined> {
  if (!isSupabaseConfigured) return undefined;
  const client = getSupabaseClient();
  if (!client) return undefined;
  try {
    const { data } = await client.auth.getSession();
    let session = data?.session ?? null;
    if (!session?.access_token) {
      const refreshed = await client.auth.refreshSession().catch(() => null);
      session = refreshed?.data?.session ?? null;
    } else if (
      typeof session.expires_at === 'number' &&
      session.expires_at * 1000 < Date.now() + 60_000
    ) {
      const refreshed = await client.auth.refreshSession().catch(() => null);
      if (refreshed?.data?.session?.access_token) {
        session = refreshed.data.session;
      }
    }
    return session?.access_token;
  } catch {
    return undefined;
  }
}

async function parseResponseJson<T = Record<string, unknown>>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchPaymentGatewayConfig(): Promise<PaymentGatewayPublicConfig> {
  const res = await fetch('/api/payments/config');
  const data = await parseResponseJson<PaymentGatewayPublicConfig & { error?: string }>(res);
  if (!res.ok || !data || typeof data.engine !== 'string') {
    throw new Error(
      data?.error || `Gateway endpoint unavailable (HTTP ${res.status}).`
    );
  }
  return data;
}

export async function createPaymentSessionIntent(params: {
  targetType: 'subscription' | 'store_order';
  channel: string;
  channelLabel?: string;
  planId?: 'pro';
  storeId?: string;
  orderId?: string;
  subscriptionId?: string;
  baseAmount?: number;
  currency?: string;
}): Promise<PaymentSessionIntent> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/payments/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await parseResponseJson<{ session?: PaymentSessionIntent; error?: string }>(res);
  if (!res.ok || !data?.session) {
    throw new Error(
      data?.error || `Could not initialize payment session (HTTP ${res.status}).`
    );
  }
  return data.session;
}

export async function pollPaymentSessionIntent(
  sessionId: string,
  readToken?: string
): Promise<PaymentSessionIntent> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (readToken) headers['x-session-token'] = readToken;

  const qs = readToken ? `?token=${encodeURIComponent(readToken)}` : '';
  const res = await fetch(`/api/payments/sessions/${encodeURIComponent(sessionId)}${qs}`, {
    headers,
  });
  const data = await parseResponseJson<{ session?: PaymentSessionIntent; error?: string }>(res);
  if (!res.ok || !data?.session) {
    throw new Error(data?.error || `Unable to check payment status (HTTP ${res.status}).`);
  }
  return data.session;
}

export async function fetchPaymentSessionByReference(
  referenceCode: string
): Promise<PaymentSessionIntent> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `/api/payments/sessions/by-ref/${encodeURIComponent(referenceCode)}`,
    { headers }
  );
  const data = await parseResponseJson<{ session?: PaymentSessionIntent; error?: string }>(res);
  if (!res.ok || !data?.session) {
    throw new Error(data?.error || `Unable to resume payment session (HTTP ${res.status}).`);
  }
  return data.session;
}

export async function setAdminGatewayEngine(
  engine: PaymentGatewayEngine
): Promise<{ engine: PaymentGatewayEngine; config: PaymentGatewayPublicConfig }> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/payments/admin/engine', {
    method: 'POST',
    headers,
    body: JSON.stringify({ engine }),
  });
  const data = await parseResponseJson<{
    engine: PaymentGatewayEngine;
    config: PaymentGatewayPublicConfig;
    error?: string;
  }>(res);
  if (!res.ok || !data) {
    throw new Error(
      data?.error || `Could not update payment gateway engine (HTTP ${res.status}).`
    );
  }
  return data;
}

export async function fetchAdminGatewayActivity(): Promise<AdminGatewayActivity> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/payments/admin/intents', { headers });
  const data = await parseResponseJson<AdminGatewayActivity & { error?: string }>(res);
  if (!res.ok || !data || !Array.isArray(data.intents)) {
    throw new Error(data?.error || `Could not fetch gateway activity (HTTP ${res.status}).`);
  }
  return data;
}

export async function sendAdminTestWebhookAlert(payload: {
  text?: string;
  amount?: number;
  channel?: string;
  reference?: string;
}): Promise<{
  ok: boolean;
  matched?: boolean;
  duplicate?: boolean;
  amount?: number;
  session?: PaymentSessionIntent;
}> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/payments/admin/test-webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseResponseJson<{
    ok: boolean;
    matched?: boolean;
    duplicate?: boolean;
    amount?: number;
    session?: PaymentSessionIntent;
    error?: string;
  }>(res);
  if (!res.ok || !data) {
    throw new Error(
      data?.error ||
        `Payment alert API unavailable (HTTP ${res.status}). Push latest code & verify server env.`
    );
  }
  return data;
}

export function isAllowedPaymongoRedirect(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'paymongo.com' || parsed.hostname.endsWith('.paymongo.com'))
    );
  } catch {
    return false;
  }
}
