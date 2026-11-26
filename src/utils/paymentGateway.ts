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
    return data?.session?.access_token;
  } catch {
    return undefined;
  }
}

export async function fetchPaymentGatewayConfig(): Promise<PaymentGatewayPublicConfig> {
  const res = await fetch('/api/payments/config');
  if (!res.ok) {
    throw new Error('Unable to load payment gateway configuration.');
  }
  return res.json();
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.session) {
    throw new Error(data?.error || 'Could not initialize payment session.');
  }
  return data.session as PaymentSessionIntent;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.session) {
    throw new Error(data?.error || 'Unable to check payment status.');
  }
  return data.session as PaymentSessionIntent;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not update payment gateway engine.');
  }
  return data;
}

export async function fetchAdminGatewayActivity(): Promise<AdminGatewayActivity> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/payments/admin/intents', { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not fetch gateway activity.');
  }
  return data as AdminGatewayActivity;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Test payment alert failed.');
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
