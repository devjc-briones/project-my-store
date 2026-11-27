import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const PLAN_PRICES_PHP = {
  pro: 369,
};
const PRO_PLAN_PRICE_ROW_ID = '__pro_plan_price__';

const INTENT_TTL_MS = 30 * 60 * 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory store guarantees instant local/preview functionality alongside Supabase persistence
const memoryIntents = new Map();
const memoryAlertKeys = new Set();
const memoryRecentAlerts = [];
let runtimeActiveEngine =
  process.env.PAYMENT_ENGINE_DEFAULT === 'paymongo' ? 'paymongo' : 'auto_match';
let runtimeProPlanPrice = PLAN_PRICES_PHP.pro;

function cleanEnvValue(raw) {
  return String(raw || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function getSupabaseServerConfig() {
  const url = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(
    /\/+$/,
    ''
  );
  const viteUrl = cleanEnvValue(process.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
  const serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
  return { url, viteUrl, serviceKey, anonKey };
}

export function isSupabaseServerAuthConfigured() {
  const { url, viteUrl, serviceKey, anonKey } = getSupabaseServerConfig();
  const activeUrl = url || viteUrl;
  return Boolean(activeUrl.startsWith('https://') && (serviceKey || anonKey));
}

function isLikelyServiceRoleKey(key) {
  if (!key) return false;
  if (key.startsWith('sb_publishable_')) return false;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload?.role && payload.role !== 'service_role') {
        return false;
      }
    } catch {
      // Ignore malformed JWT segment
    }
  }
  return true;
}

function getSupabaseAdminClient() {
  const { url, serviceKey } = getSupabaseServerConfig();
  if (!url.startsWith('https://') || !isLikelyServiceRoleKey(serviceKey)) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getSupabaseAnonOrScopedClient(accessToken, overrideUrl) {
  const { url, serviceKey, anonKey } = getSupabaseServerConfig();
  const targetUrl = overrideUrl || url;
  const validServiceKey = isLikelyServiceRoleKey(serviceKey) ? serviceKey : '';
  const key = (!overrideUrl ? validServiceKey : '') || anonKey || serviceKey;
  if (!targetUrl.startsWith('https://') || !key) return null;
  return createClient(targetUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global:
      accessToken && (Boolean(overrideUrl) || !validServiceKey)
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
  });
}

function constantTimeEquals(a, b) {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

export async function verifySupabaseCaller(accessToken) {
  const { url, viteUrl, serviceKey, anonKey } = getSupabaseServerConfig();
  if (!isSupabaseServerAuthConfigured()) {
    return { authenticated: false, reason: 'Supabase auth is not configured on the server.' };
  }
  if (!accessToken) {
    return {
      authenticated: false,
      reason: 'No active admin login token found. Please sign out and sign in again.',
    };
  }

  const candidateClients = [];
  const adminClient = getSupabaseAdminClient();
  const { serviceKey: rawServiceKey } = getSupabaseServerConfig();
  const fallbackKey = anonKey || rawServiceKey;

  const scopedPrimaryClient =
    fallbackKey && url.startsWith('https://')
      ? createClient(url, fallbackKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        })
      : null;

  const scopedViteClient =
    fallbackKey && viteUrl.startsWith('https://') && viteUrl !== url
      ? createClient(viteUrl, fallbackKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        })
      : null;

  if (adminClient) candidateClients.push(adminClient);
  if (scopedPrimaryClient) candidateClients.push(scopedPrimaryClient);
  if (scopedViteClient) candidateClients.push(scopedViteClient);

  let verifiedUser = null;
  let verifiedClient = null;
  let lastAuthError = '';

  for (const candidate of candidateClients) {
    try {
      const { data, error } = await candidate.auth.getUser(accessToken);
      if (!error && data?.user?.id) {
        verifiedUser = data.user;
        verifiedClient = candidate;
        break;
      }
      if (error?.message) lastAuthError = error.message;
    } catch (err) {
      if (err?.message) lastAuthError = err.message;
    }
  }

  if (!verifiedUser?.id || !verifiedClient) {
    return {
      authenticated: false,
      reason: lastAuthError
        ? `Session verification failed (${lastAuthError}). Please sign out and log back in.`
        : 'Admin session expired or invalid. Please sign out and log back in.',
    };
  }

  let userRow = null;
  const lookupClients = Array.from(
    new Set([adminClient, scopedPrimaryClient, scopedViteClient, verifiedClient].filter(Boolean))
  );
  for (const dbClient of lookupClients) {
    try {
      const { data, error } = await dbClient
        .from('users')
        .select('*')
        .eq('id', verifiedUser.id)
        .maybeSingle();
      if (!error && data) {
        userRow = data;
        break;
      }
      if (verifiedUser.email) {
        const { data: byEmail, error: emailErr } = await dbClient
          .from('users')
          .select('*')
          .eq('email', verifiedUser.email.toLowerCase())
          .maybeSingle();
        if (!emailErr && byEmail) {
          userRow = byEmail;
          break;
        }
      }
    } catch {
      // Try next client
    }
  }

  let parsedRoleId;
  if (userRow?.role_id !== undefined && userRow?.role_id !== null) {
    parsedRoleId = Number(userRow.role_id);
  } else if (typeof userRow?.role === 'string') {
    const normalizedRole = userRow.role.trim().toLowerCase();
    if (normalizedRole === 'admin') parsedRoleId = 1;
    else if (normalizedRole === 'seller') parsedRoleId = 2;
    else if (normalizedRole === 'buyer') parsedRoleId = 3;
  }

  return {
    authenticated: true,
    userId: verifiedUser.id,
    email: userRow?.email || verifiedUser.email || undefined,
    roleId: Number.isFinite(parsedRoleId) ? parsedRoleId : undefined,
    reason: !userRow ? 'Admin user profile row not found in public.users table.' : undefined,
  };
}

export async function checkAdminAccess(accessToken) {
  if (!isSupabaseServerAuthConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Server Supabase configuration missing (SUPABASE_URL / key).',
    };
  }
  const caller = await verifySupabaseCaller(accessToken);
  if (!caller.authenticated) {
    return {
      allowed: false,
      reason: caller.reason || 'Admin session required. Please sign in again.',
    };
  }
  if (caller.roleId !== 1) {
    return {
      allowed: false,
      reason:
        caller.reason ||
        `Admin privileges required (account role_id is ${caller.roleId ?? 'unset'}, expected 1).`,
    };
  }
  return { allowed: true, caller };
}

export async function isCallerAdmin(accessToken) {
  const result = await checkAdminAccess(accessToken);
  return result.allowed;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function isValidPaymongoCheckoutUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'paymongo.com' || parsed.hostname.endsWith('.paymongo.com'))
    );
  } catch {
    return false;
  }
}

function pruneExpiredMemoryIntents(nowMs = Date.now()) {
  for (const [id, intent] of memoryIntents.entries()) {
    if (intent.status === 'awaiting_payment' && new Date(intent.expiresAt).getTime() <= nowMs) {
      intent.status = 'expired';
      intent.updatedAt = new Date(nowMs).toISOString();
      memoryIntents.set(id, intent);
    }
  }
}

export async function getActiveGatewayEngine() {
  const adminClient = getSupabaseAdminClient() || getSupabaseAnonOrScopedClient();
  if (adminClient) {
    try {
      const { data } = await adminClient
        .from('platform_gateway_config')
        .select('active_engine')
        .eq('id', 'default')
        .maybeSingle();
      if (data?.active_engine === 'paymongo' || data?.active_engine === 'auto_match') {
        runtimeActiveEngine = data.active_engine;
      }
    } catch {
      // Fallback cleanly if table hasn't been created yet
    }
  }
  return runtimeActiveEngine;
}

export async function setActiveGatewayEngine(engine, adminUserId) {
  runtimeActiveEngine = engine;
  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    try {
      await adminClient.from('platform_gateway_config').upsert(
        {
          id: 'default',
          active_engine: engine,
          updated_by: adminUserId && UUID_REGEX.test(adminUserId) ? adminUserId : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // Ignore if schema migration hasn't been applied yet
    }
  }
  return runtimeActiveEngine;
}

export async function getProPlanPricePhp() {
  const client = getSupabaseAdminClient() || getSupabaseAnonOrScopedClient();
  if (client) {
    try {
      const { data } = await client
        .from('platform_payment_channels')
        .select('account_number')
        .eq('id', PRO_PLAN_PRICE_ROW_ID)
        .maybeSingle();
      const parsed = Number(data?.account_number);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 1_000_000) {
        runtimeProPlanPrice = roundMoney(parsed);
      }
    } catch {
      // Fallback cleanly to runtimeProPlanPrice
    }
  }
  return runtimeProPlanPrice;
}

export async function setProPlanPricePhp(price) {
  const parsed = Number(price);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1_000_000) {
    throw new Error('Pro plan price must be between ₱1 and ₱1,000,000.');
  }
  const safePrice = roundMoney(parsed);
  runtimeProPlanPrice = safePrice;

  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    try {
      await adminClient.from('platform_payment_channels').upsert(
        {
          id: PRO_PLAN_PRICE_ROW_ID,
          channel_type: 'custom',
          label: 'Pro Plan Monthly Price',
          subtitle: 'Platform subscription pricing configuration',
          is_enabled: true,
          requires_receipt: false,
          account_name: 'PRO_PLAN_PRICE_PHP',
          number_label: 'PHP',
          account_number: String(safePrice),
          sort_order: 9999,
        },
        { onConflict: 'id' }
      );
    } catch {
      // Ignore if table hasn't been migrated yet
    }
  }
  return runtimeProPlanPrice;
}

export async function getPublicGatewayConfig(baseOrigin = '') {
  const [engine, proPlanPrice] = await Promise.all([
    getActiveGatewayEngine(),
    getProPlanPricePhp(),
  ]);
  const { serviceKey } = getSupabaseServerConfig();
  const paymongoConfigured = Boolean((process.env.PAYMONGO_SECRET_KEY || '').trim());
  const localWebhookConfigured = Boolean((process.env.LOCAL_PAYMENT_WEBHOOK_SECRET || '').trim());
  const supabaseServiceConfigured = Boolean(getSupabaseAdminClient());
  const supabaseKeyWarning =
    serviceKey && !isLikelyServiceRoleKey(serviceKey)
      ? 'Anon/Publishable key detected in SUPABASE_SERVICE_ROLE_KEY slot — use the Secret/service_role key.'
      : undefined;

  return {
    engine,
    proPlanPrice,
    zeroReceiptMode: true,
    supportedChannels: ['gcash', 'maya', 'bank', 'qrph'],
    paymongoConfigured,
    localWebhookConfigured,
    supabaseServiceConfigured,
    ...(supabaseKeyWarning ? { supabaseKeyWarning } : {}),
    localWebhookPath: '/api/payments/local-webhook',
    localWebhookUrl: baseOrigin
      ? `${baseOrigin}/api/payments/local-webhook`
      : '/api/payments/local-webhook',
    paymongoWebhookPath: '/api/payments/paymongo-webhook',
    paymongoWebhookUrl: baseOrigin
      ? `${baseOrigin}/api/payments/paymongo-webhook`
      : '/api/payments/paymongo-webhook',
  };
}

async function allocateUniquePayableAmount(baseAmount) {
  pruneExpiredMemoryIntents();
  const usedCents = new Set();
  const nowIso = new Date().toISOString();

  for (const intent of memoryIntents.values()) {
    if (intent.status === 'awaiting_payment' && intent.expiresAt > nowIso) {
      usedCents.add(Math.round(intent.uniquePayableAmount * 100));
    }
  }

  const dbClient = getSupabaseAdminClient();
  if (dbClient) {
    try {
      const { data } = await dbClient
        .from('payment_intents')
        .select('unique_payable_amount')
        .eq('status', 'awaiting_payment')
        .gt('expires_at', nowIso);
      for (const row of data || []) {
        const amt = Number(row.unique_payable_amount);
        if (Number.isFinite(amt)) {
          usedCents.add(Math.round(amt * 100));
        }
      }
    } catch {
      // Ignore if payment_intents table isn't migrated yet
    }
  }

  const baseCents = Math.round(roundMoney(baseAmount) * 100);
  const candidates = [];
  for (let offset = 1; offset <= 99; offset += 1) {
    const candidate = baseCents + offset;
    if (!usedCents.has(candidate)) {
      candidates.push(candidate);
    }
  }

  if (candidates.length > 0) {
    const picked = candidates[crypto.randomInt(0, candidates.length)];
    return roundMoney(picked / 100);
  }

  for (let offset = 101; offset <= 199; offset += 1) {
    const candidate = baseCents + offset;
    if (!usedCents.has(candidate)) {
      return roundMoney(candidate / 100);
    }
  }

  return roundMoney((baseCents + crypto.randomInt(201, 299)) / 100);
}

function mapChannelToPaymongoMethods(channel) {
  const normalized = channel.toLowerCase();
  if (normalized.includes('gcash')) return ['gcash', 'qrph'];
  if (normalized.includes('maya')) return ['paymaya', 'qrph'];
  if (normalized.includes('bank')) return ['dob', 'dob_ubp', 'qrph'];
  return ['qrph', 'gcash', 'paymaya', 'dob', 'dob_ubp'];
}

async function createPaymongoCheckoutSession(params) {
  const secretKey = (process.env.PAYMONGO_SECRET_KEY || '').trim();
  if (!secretKey) {
    throw new Error('PAYMONGO_SECRET_KEY is not configured on the server.');
  }

  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  const centavos = Math.max(2000, Math.round(params.amountPhp * 100));

  const callApi = async (paymentMethodTypes) => {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            description: params.description,
            reference_number: params.referenceCode,
            payment_method_types: paymentMethodTypes,
            line_items: [
              {
                currency: 'PHP',
                amount: centavos,
                name: params.description,
                quantity: 1,
              },
            ],
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: {
              reference_code: params.referenceCode,
              channel: params.channel,
            },
          },
        },
      }),
    });

    const json = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, json };
  };

  let result = await callApi(mapChannelToPaymongoMethods(params.channel));
  if (!result.ok) {
    result = await callApi(['qrph']);
  }

  if (!result.ok) {
    const errDetail =
      result.json?.errors?.[0]?.detail || 'Unable to create PayMongo checkout session.';
    throw new Error(errDetail);
  }

  const sessionId = result.json?.data?.id;
  const checkoutUrl = result.json?.data?.attributes?.checkout_url;
  if (!sessionId || !isValidPaymongoCheckoutUrl(checkoutUrl)) {
    throw new Error('PayMongo returned an invalid checkout URL.');
  }

  return { externalSessionId: String(sessionId), checkoutUrl };
}

async function fetchPaymongoSessionPaidState(externalSessionId) {
  const secretKey = (process.env.PAYMONGO_SECRET_KEY || '').trim();
  if (!secretKey || !externalSessionId) return false;
  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
    const res = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(externalSessionId)}`,
      {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      }
    );
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    const attrs = json?.data?.attributes;
    const paymentStatus = String(attrs?.payment_intent?.attributes?.status || '').toLowerCase();
    const payments = Array.isArray(attrs?.payments) ? attrs.payments : [];
    const hasPaidPayment = payments.some(
      (p) => String(p?.attributes?.status || '').toLowerCase() === 'paid'
    );
    return paymentStatus === 'succeeded' || hasPaidPayment;
  } catch {
    return false;
  }
}

async function persistIntentToSupabase(intent, accessToken) {
  const client = getSupabaseAdminClient() || getSupabaseAnonOrScopedClient(accessToken);
  if (!client) return;
  try {
    await client.from('payment_intents').upsert(
      {
        id: intent.id,
        reference_code: intent.referenceCode,
        target_type: intent.targetType,
        user_id: intent.userId && UUID_REGEX.test(intent.userId) ? intent.userId : null,
        store_id: intent.storeId && UUID_REGEX.test(intent.storeId) ? intent.storeId : null,
        order_id: intent.orderId && UUID_REGEX.test(intent.orderId) ? intent.orderId : null,
        subscription_id:
          intent.subscriptionId && UUID_REGEX.test(intent.subscriptionId)
            ? intent.subscriptionId
            : null,
        plan_id: intent.planId ?? null,
        channel: intent.channel,
        provider: intent.provider,
        currency: intent.currency,
        base_amount: intent.baseAmount,
        unique_payable_amount: intent.uniquePayableAmount,
        external_session_id: intent.externalSessionId ?? null,
        checkout_url: intent.checkoutUrl ?? null,
        status: intent.status,
        matched_alert_reference: intent.matchedAlertReference ?? null,
        paid_at: intent.paidAt ?? null,
        expires_at: intent.expiresAt,
        created_at: intent.createdAt,
        updated_at: intent.updatedAt,
      },
      { onConflict: 'id' }
    );
  } catch {
    // Table may not exist yet in legacy deployments
  }
}

async function loadIntentFromSupabase(intentId) {
  if (!UUID_REGEX.test(intentId)) return null;
  const client = getSupabaseAdminClient();
  if (!client) return null;
  try {
    const { data } = await client
      .from('payment_intents')
      .select('*')
      .eq('id', intentId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      referenceCode: data.reference_code,
      readToken: '',
      targetType: data.target_type,
      userId: data.user_id || undefined,
      storeId: data.store_id || undefined,
      orderId: data.order_id || undefined,
      subscriptionId: data.subscription_id || undefined,
      planId: data.plan_id || undefined,
      channel: data.channel,
      channelLabel: data.channel,
      provider: data.provider,
      currency: data.currency || 'PHP',
      baseAmount: Number(data.base_amount),
      uniquePayableAmount: Number(data.unique_payable_amount),
      externalSessionId: data.external_session_id || undefined,
      checkoutUrl: data.checkout_url || undefined,
      status: data.status,
      matchedAlertReference: data.matched_alert_reference || undefined,
      paidAt: data.paid_at || undefined,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

async function syncTargetRecordsOnPaid(intent) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return;
  const nowIso = intent.paidAt || new Date().toISOString();

  try {
    if (intent.targetType === 'subscription' && intent.userId && UUID_REGEX.test(intent.userId)) {
      const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const targetPlan = intent.planId || 'pro';

      if (intent.subscriptionId && UUID_REGEX.test(intent.subscriptionId)) {
        await adminClient
          .from('subscriptions')
          .update({
            status: 'paid',
            period_start: nowIso,
            period_end: nextPeriodEnd,
            approved_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', intent.subscriptionId);
      } else {
        await adminClient.from('subscriptions').upsert(
          {
            id: crypto.randomUUID(),
            reference_id: intent.referenceCode,
            user_id: intent.userId,
            plan_id: targetPlan,
            amount: intent.baseAmount,
            payment_method: intent.channelLabel,
            status: 'paid',
            period_start: nowIso,
            period_end: nextPeriodEnd,
            approved_at: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'reference_id' }
        );
      }

      await adminClient
        .from('users')
        .update({
          plan: targetPlan,
          plan_period_ends_at: targetPlan === 'pro' ? nextPeriodEnd : null,
          cancel_at_period_end: false,
          updated_at: nowIso,
        })
        .eq('id', intent.userId);
    }

    if (intent.targetType === 'store_order' && intent.orderId && UUID_REGEX.test(intent.orderId)) {
      await adminClient
        .from('store_product_payments')
        .update({
          payment_status: 'paid',
          amount_paid: intent.baseAmount,
          reference_number: intent.matchedAlertReference || intent.referenceCode,
          paid_at: nowIso,
          updated_at: nowIso,
        })
        .eq('order_id', intent.orderId);
    }
  } catch (err) {
    console.error('Supabase target payment sync failed:', err);
  }
}

export async function markPaymentIntentPaid(intentId, alertReference) {
  const existing = memoryIntents.get(intentId) || (await loadIntentFromSupabase(intentId));
  if (!existing) return null;
  if (existing.status === 'paid') return existing;

  const nowIso = new Date().toISOString();
  const updated = {
    ...existing,
    status: 'paid',
    matchedAlertReference: alertReference || existing.matchedAlertReference,
    paidAt: nowIso,
    updatedAt: nowIso,
  };
  memoryIntents.set(updated.id, updated);
  await persistIntentToSupabase(updated);
  await syncTargetRecordsOnPaid(updated);
  return updated;
}

export function sanitizeIntentForClient(intent, includeReadToken = false) {
  return {
    id: intent.id,
    referenceCode: intent.referenceCode,
    ...(includeReadToken ? { readToken: intent.readToken } : {}),
    targetType: intent.targetType,
    planId: intent.planId,
    storeId: intent.storeId,
    channel: intent.channel,
    channelLabel: intent.channelLabel,
    provider: intent.provider,
    currency: intent.currency,
    baseAmount: intent.baseAmount,
    uniquePayableAmount: intent.uniquePayableAmount,
    checkoutUrl: intent.checkoutUrl,
    status: intent.status,
    matchedAlertReference: intent.matchedAlertReference,
    paidAt: intent.paidAt,
    expiresAt: intent.expiresAt,
    createdAt: intent.createdAt,
  };
}

export async function createPaymentSession(params) {
  const caller = params.accessToken ? await verifySupabaseCaller(params.accessToken) : null;
  const activeEngine = await getActiveGatewayEngine();

  let authoritativeAmount = 0;
  let description = 'mystore Payment';
  let planId;

  if (params.targetType === 'subscription') {
    planId = 'pro';
    authoritativeAmount = await getProPlanPricePhp();
    description = 'mystore Pro Plan (30 Days)';
  } else {
    const rawAmount = Number(params.baseAmount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 10_000_000) {
      return {
        intent: null,
        error: 'Invalid order payment amount.',
        statusCode: 400,
      };
    }
    authoritativeAmount = roundMoney(rawAmount);
    description = `mystore Order Payment (${params.channelLabel || params.channel})`;
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAtIso = new Date(now + INTENT_TTL_MS).toISOString();
  const id = crypto.randomUUID();
  const referenceCode = `PAY-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const readToken = crypto.randomBytes(24).toString('hex');

  let uniquePayableAmount = authoritativeAmount;
  let externalSessionId;
  let checkoutUrl;

  if (activeEngine === 'auto_match') {
    uniquePayableAmount = await allocateUniquePayableAmount(authoritativeAmount);
  } else {
    const safeOrigin =
      params.originUrl && /^https?:\/\//i.test(params.originUrl)
        ? params.originUrl.replace(/\/$/, '')
        : 'http://localhost:3000';
    const returnBase =
      params.targetType === 'subscription' ? `${safeOrigin}/upgrade-plan` : safeOrigin;
    try {
      const pm = await createPaymongoCheckoutSession({
        referenceCode,
        description,
        amountPhp: authoritativeAmount,
        channel: params.channel,
        successUrl: `${returnBase}?payment_session=${id}&status=success`,
        cancelUrl: `${returnBase}?payment_session=${id}&status=cancelled`,
      });
      externalSessionId = pm.externalSessionId;
      checkoutUrl = pm.checkoutUrl;
    } catch (err) {
      return {
        intent: null,
        error: err?.message || 'PayMongo checkout creation failed.',
        statusCode: 502,
      };
    }
  }

  const record = {
    id,
    referenceCode,
    readToken,
    targetType: params.targetType,
    userId: caller?.userId,
    userEmail: caller?.email,
    storeId: params.storeId,
    orderId: params.orderId,
    subscriptionId: params.subscriptionId,
    planId,
    channel: params.channel,
    channelLabel: params.channelLabel || params.channel,
    provider: activeEngine,
    currency: params.currency || 'PHP',
    baseAmount: authoritativeAmount,
    uniquePayableAmount,
    externalSessionId,
    checkoutUrl,
    status: 'awaiting_payment',
    expiresAt: expiresAtIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  memoryIntents.set(record.id, record);
  await persistIntentToSupabase(record, params.accessToken);
  return { intent: record };
}

export async function getPaymentSessionStatus(params) {
  pruneExpiredMemoryIntents();
  let intent = memoryIntents.get(params.intentId) || (await loadIntentFromSupabase(params.intentId));
  if (!intent) {
    return { error: 'Payment session not found.', statusCode: 404 };
  }

  const caller = params.accessToken ? await verifySupabaseCaller(params.accessToken) : null;
  const tokenMatches = Boolean(
    params.readToken && intent.readToken && constantTimeEquals(params.readToken, intent.readToken)
  );
  const userMatches = Boolean(
    caller?.authenticated &&
      (caller.roleId === 1 || (intent.userId && caller.userId === intent.userId))
  );

  if (!tokenMatches && !userMatches) {
    return { error: 'Unauthorized payment session access.', statusCode: 403 };
  }

  if (intent.status === 'awaiting_payment' && new Date(intent.expiresAt).getTime() <= Date.now()) {
    intent = { ...intent, status: 'expired', updatedAt: new Date().toISOString() };
    memoryIntents.set(intent.id, intent);
    await persistIntentToSupabase(intent);
  }

  if (intent.status === 'awaiting_payment' && intent.provider === 'paymongo' && intent.externalSessionId) {
    const isPaid = await fetchPaymongoSessionPaidState(intent.externalSessionId);
    if (isPaid) {
      intent = (await markPaymentIntentPaid(intent.id, intent.externalSessionId)) || intent;
    }
  }

  return { intent };
}

export async function getPaymentSessionByReference(params) {
  pruneExpiredMemoryIntents();
  const cleanRef = String(params.referenceCode || '').trim().toUpperCase();
  if (!cleanRef) {
    return { error: 'Payment reference is required.', statusCode: 400 };
  }

  let intent = null;
  for (const item of memoryIntents.values()) {
    if (String(item.referenceCode || '').toUpperCase() === cleanRef) {
      intent = item;
      break;
    }
  }

  if (!intent) {
    const client = getSupabaseAdminClient() || getSupabaseAnonOrScopedClient(params.accessToken);
    if (client) {
      try {
        const { data } = await client
          .from('payment_intents')
          .select('*')
          .eq('reference_code', cleanRef)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          intent = {
            id: data.id,
            referenceCode: data.reference_code,
            readToken: '',
            targetType: data.target_type,
            userId: data.user_id || undefined,
            storeId: data.store_id || undefined,
            orderId: data.order_id || undefined,
            subscriptionId: data.subscription_id || undefined,
            planId: data.plan_id || undefined,
            channel: data.channel,
            channelLabel: data.channel,
            provider: data.provider,
            currency: data.currency || 'PHP',
            baseAmount: Number(data.base_amount),
            uniquePayableAmount: Number(data.unique_payable_amount),
            externalSessionId: data.external_session_id || undefined,
            checkoutUrl: data.checkout_url || undefined,
            status: data.status,
            matchedAlertReference: data.matched_alert_reference || undefined,
            paidAt: data.paid_at || undefined,
            expiresAt: data.expires_at,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch {
        // Ignore if table not available
      }
    }
  }

  if (!intent) {
    return { error: 'Payment session not found for this reference.', statusCode: 404 };
  }

  if (isSupabaseServerAuthConfigured()) {
    const caller = params.accessToken ? await verifySupabaseCaller(params.accessToken) : null;
    const allowed = Boolean(
      caller?.authenticated &&
        (caller.roleId === 1 || !intent.userId || caller.userId === intent.userId)
    );
    if (!allowed) {
      return { error: 'Unauthorized payment session access.', statusCode: 403 };
    }
  }

  if (intent.status === 'awaiting_payment' && new Date(intent.expiresAt).getTime() <= Date.now()) {
    intent = { ...intent, status: 'expired', updatedAt: new Date().toISOString() };
    memoryIntents.set(intent.id, intent);
    await persistIntentToSupabase(intent);
  }

  return { intent };
}

export function parseLocalCreditAlert(payload) {
  const rawText = String(
    payload.text || payload.message || payload.body || payload.notification || ''
  ).trim();
  let amount;

  if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
    const cleaned = String(payload.amount).replace(/[₱,\s]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      amount = roundMoney(parsed);
    }
  }

  if (amount === undefined && rawText) {
    const currencyMatch =
      rawText.match(/(?:PHP|₱|PhP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+\.[0-9]{2})/i) ||
      rawText.match(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|[0-9]+\.[0-9]{2})\b/);
    if (currencyMatch?.[1]) {
      const parsed = Number(currencyMatch[1].replace(/,/g, ''));
      if (Number.isFinite(parsed) && parsed > 0) {
        amount = roundMoney(parsed);
      }
    }
  }

  const lower = rawText.toLowerCase();
  let channel = typeof payload.channel === 'string' ? payload.channel.trim().toLowerCase() : undefined;
  if (!channel) {
    if (lower.includes('gcash')) channel = 'gcash';
    else if (lower.includes('maya') || lower.includes('paymaya')) channel = 'maya';
    else if (lower.includes('instapay') || lower.includes('pesonet') || lower.includes('bank')) {
      channel = 'bank';
    } else {
      channel = 'qrph';
    }
  }

  let reference =
    typeof payload.reference === 'string' && payload.reference.trim()
      ? payload.reference.trim()
      : undefined;
  if (!reference && rawText) {
    const refMatch = rawText.match(
      /(?:ref(?:erence)?\.?\s*(?:no\.?|#|number)?[:\s-]*)([A-Z0-9-]{6,24})/i
    );
    if (refMatch?.[1]) reference = refMatch[1].trim();
  }

  const sender =
    typeof payload.sender === 'string' && payload.sender.trim() ? payload.sender.trim() : undefined;

  return { amount, channel, reference, sender, rawText };
}

export async function processLocalWebhookAlert(params) {
  if (!params.skipSecretCheck) {
    const configuredSecret = (process.env.LOCAL_PAYMENT_WEBHOOK_SECRET || '').trim();
    if (!configuredSecret) {
      return {
        ok: false,
        statusCode: 503,
        error: 'LOCAL_PAYMENT_WEBHOOK_SECRET is not configured on the server.',
      };
    }
    if (!params.providedSecret || !constantTimeEquals(params.providedSecret, configuredSecret)) {
      return { ok: false, statusCode: 401, error: 'Unauthorized webhook secret.' };
    }
  }

  const parsed = parseLocalCreditAlert(params.payload);
  if (!parsed.amount) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Could not extract a valid peso amount from the payment alert.',
    };
  }

  const dedupeMaterial = parsed.reference
    ? `${parsed.channel}:${parsed.amount.toFixed(2)}:${parsed.reference}`
    : `${parsed.channel}:${parsed.amount.toFixed(2)}:${parsed.rawText}`;
  const idempotencyKey = crypto.createHash('sha256').update(dedupeMaterial).digest('hex');

  if (memoryAlertKeys.has(idempotencyKey)) {
    return {
      ok: true,
      statusCode: 200,
      matched: false,
      duplicate: true,
      amount: parsed.amount,
    };
  }
  memoryAlertKeys.add(idempotencyKey);

  pruneExpiredMemoryIntents();
  const targetCents = Math.round(parsed.amount * 100);
  const nowIso = new Date().toISOString();

  let matchedIntent;
  for (const intent of memoryIntents.values()) {
    if (
      intent.status === 'awaiting_payment' &&
      intent.expiresAt > nowIso &&
      Math.round(intent.uniquePayableAmount * 100) === targetCents
    ) {
      matchedIntent = intent;
      break;
    }
  }

  const adminClient = getSupabaseAdminClient();
  if (!matchedIntent && adminClient) {
    try {
      const { data: rows } = await adminClient
        .from('payment_intents')
        .select('*')
        .eq('status', 'awaiting_payment')
        .eq('unique_payable_amount', parsed.amount)
        .gt('expires_at', nowIso)
        .limit(1);
      const row = rows?.[0];
      if (row) {
        matchedIntent = (await loadIntentFromSupabase(row.id)) || undefined;
      }
    } catch {
      // Ignore if table doesn't exist yet
    }
  }

  const alertRef =
    parsed.reference || `ALERT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  let confirmedIntent;
  if (matchedIntent) {
    confirmedIntent = (await markPaymentIntentPaid(matchedIntent.id, alertRef)) || undefined;
  }

  const alertRecord = {
    id: crypto.randomUUID(),
    idempotencyKey,
    provider: params.skipSecretCheck ? 'admin_test_alert' : 'local_forwarder',
    channel: parsed.channel,
    amount: parsed.amount,
    senderName: parsed.sender,
    externalReference: alertRef,
    matchedIntentId: confirmedIntent?.id,
    receivedAt: nowIso,
  };
  memoryRecentAlerts.unshift(alertRecord);
  if (memoryRecentAlerts.length > 30) memoryRecentAlerts.pop();

  if (adminClient) {
    try {
      await adminClient.from('incoming_payment_alerts').insert({
        id: alertRecord.id,
        idempotency_key: idempotencyKey,
        provider: alertRecord.provider,
        channel: parsed.channel ?? null,
        amount: parsed.amount,
        sender_name: parsed.sender ?? null,
        external_reference: alertRef,
        raw_payload: parsed.rawText.slice(0, 1000) || null,
        matched_intent_id: confirmedIntent?.id ?? null,
        received_at: nowIso,
      });
    } catch {
      // Ignore duplicate or missing table errors cleanly
    }
  }

  return {
    ok: true,
    statusCode: 200,
    matched: Boolean(confirmedIntent),
    duplicate: false,
    amount: parsed.amount,
    intent: confirmedIntent,
  };
}

export function verifyPaymongoSignature(rawBody, signatureHeader) {
  const webhookSecret = (process.env.PAYMONGO_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret || !signatureHeader) return false;

  const parts = new Map();
  for (const segment of signatureHeader.split(',')) {
    const [k, v] = segment.split('=');
    if (k && v) parts.set(k.trim(), v.trim());
  }

  const timestamp = parts.get('t');
  const candidateSig = parts.get('li') || parts.get('te');
  if (!timestamp || !candidateSig) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 600) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return constantTimeEquals(candidateSig, expected);
}

export async function processPaymongoWebhook(params) {
  if (!verifyPaymongoSignature(params.rawBody, params.signatureHeader)) {
    return { ok: false, statusCode: 401, error: 'Invalid PayMongo webhook signature.' };
  }

  let event;
  try {
    event = JSON.parse(params.rawBody);
  } catch {
    return { ok: false, statusCode: 400, error: 'Invalid JSON payload.' };
  }

  const eventType = String(event?.data?.attributes?.type || '');
  const resourceData = event?.data?.attributes?.data;
  const sessionId =
    resourceData?.id ||
    resourceData?.attributes?.checkout_session_id ||
    resourceData?.attributes?.metadata?.checkout_session_id;
  const referenceCode = resourceData?.attributes?.reference_number;

  if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
    let matchedId;
    for (const intent of memoryIntents.values()) {
      if (
        (sessionId && intent.externalSessionId === sessionId) ||
        (referenceCode && intent.referenceCode === referenceCode)
      ) {
        matchedId = intent.id;
        break;
      }
    }

    const adminClient = getSupabaseAdminClient();
    if (!matchedId && adminClient && sessionId) {
      const { data: row } = await adminClient
        .from('payment_intents')
        .select('id')
        .eq('external_session_id', sessionId)
        .maybeSingle();
      matchedId = row?.id;
    }

    if (matchedId) {
      await markPaymentIntentPaid(matchedId, sessionId || referenceCode);
    }
  }

  return { ok: true, statusCode: 200 };
}

export async function listActiveIntentsForAdmin() {
  pruneExpiredMemoryIntents();

  const mergedIntents = new Map();
  for (const item of memoryIntents.values()) {
    mergedIntents.set(item.id, sanitizeIntentForClient(item, false));
  }

  let recentAlerts = memoryRecentAlerts.slice(0, 15);

  const adminClient = getSupabaseAdminClient();
  if (adminClient) {
    try {
      const [{ data: dbIntents }, { data: dbAlerts }] = await Promise.all([
        adminClient
          .from('payment_intents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        adminClient
          .from('incoming_payment_alerts')
          .select('*')
          .order('received_at', { ascending: false })
          .limit(15),
      ]);

      for (const row of dbIntents || []) {
        if (!mergedIntents.has(row.id)) {
          mergedIntents.set(row.id, {
            id: row.id,
            referenceCode: row.reference_code,
            targetType: row.target_type,
            planId: row.plan_id || undefined,
            storeId: row.store_id || undefined,
            channel: row.channel,
            channelLabel: row.channel,
            provider: row.provider,
            currency: row.currency || 'PHP',
            baseAmount: Number(row.base_amount),
            uniquePayableAmount: Number(row.unique_payable_amount),
            checkoutUrl: row.checkout_url || undefined,
            status: row.status,
            matchedAlertReference: row.matched_alert_reference || undefined,
            paidAt: row.paid_at || undefined,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
          });
        }
      }

      if (Array.isArray(dbAlerts) && dbAlerts.length > 0) {
        const seenAlertIds = new Set(recentAlerts.map((a) => a.id));
        const mergedAlerts = [...recentAlerts];
        for (const row of dbAlerts) {
          if (!seenAlertIds.has(row.id)) {
            mergedAlerts.push({
              id: row.id,
              provider: row.provider,
              channel: row.channel || undefined,
              amount: Number(row.amount),
              senderName: row.sender_name || undefined,
              externalReference: row.external_reference || undefined,
              matchedIntentId: row.matched_intent_id || undefined,
              receivedAt: row.received_at,
            });
          }
        }
        recentAlerts = mergedAlerts
          .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
          .slice(0, 15);
      }
    } catch {
      // Fallback cleanly to memory if tables aren't migrated yet
    }
  }

  return {
    intents: Array.from(mergedIntents.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20),
    recentAlerts,
  };
}
