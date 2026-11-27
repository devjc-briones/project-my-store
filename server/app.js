import express from 'express';
import {
  checkAdminAccess,
  createPaymentSession,
  extractBearerToken,
  getPaymentSessionByReference,
  getPaymentSessionStatus,
  getPublicGatewayConfig,
  listActiveIntentsForAdmin,
  processLocalWebhookAlert,
  processPaymongoWebhook,
  sanitizeIntentForClient,
  setActiveGatewayEngine,
  verifySupabaseCaller,
} from './paymentsService.js';

export function createPaymentsApiApp() {
  const app = express();

  // Handle platforms like Vercel that may pre-parse req.body before Express runs
  app.use((req, _res, next) => {
    if (req.body !== undefined && !Buffer.isBuffer(req.body)) {
      if (typeof req.body === 'string') {
        const trimmed = req.body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            req.body = JSON.parse(trimmed);
          } catch {
            // Leave raw string intact if not valid JSON
          }
        }
      }
      req._body = true;
    }
    next();
  });

  // Capture raw bytes specifically for PayMongo HMAC webhook signature verification
  app.post(
    '/api/payments/paymongo-webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req, res) => {
      try {
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body || {});
        const signatureHeader =
          typeof req.headers['paymongo-signature'] === 'string'
            ? req.headers['paymongo-signature']
            : undefined;
        const result = await processPaymongoWebhook({ rawBody, signatureHeader });
        if (!result.ok) {
          res.status(result.statusCode).json({ ok: false, error: result.error });
          return;
        }
        res.status(200).json({ ok: true });
      } catch {
        res.status(500).json({ ok: false, error: 'Failed to process PayMongo webhook.' });
      }
    }
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/payments/config', async (req, res) => {
    try {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const baseOrigin = host ? `${proto}://${host}` : '';
      const config = await getPublicGatewayConfig(baseOrigin);
      res.status(200).json(config);
    } catch {
      res.status(500).json({ error: 'Unable to load payment gateway configuration.' });
    }
  });

  app.post('/api/payments/sessions', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const targetType = body.targetType === 'subscription' ? 'subscription' : 'store_order';
      const channel =
        typeof body.channel === 'string' && body.channel.trim() ? body.channel.trim() : 'qrph';
      const channelLabel =
        typeof body.channelLabel === 'string' && body.channelLabel.trim()
          ? body.channelLabel.trim()
          : channel;
      const accessToken = extractBearerToken(req.headers.authorization);
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const originUrl = host ? `${proto}://${host}` : undefined;

      const created = await createPaymentSession({
        targetType,
        channel,
        channelLabel,
        planId: body.planId === 'pro' ? 'pro' : undefined,
        storeId: typeof body.storeId === 'string' ? body.storeId : undefined,
        orderId: typeof body.orderId === 'string' ? body.orderId : undefined,
        subscriptionId: typeof body.subscriptionId === 'string' ? body.subscriptionId : undefined,
        baseAmount:
          typeof body.baseAmount === 'number' ? body.baseAmount : Number(body.baseAmount),
        currency: typeof body.currency === 'string' ? body.currency : 'PHP',
        originUrl,
        accessToken,
      });

      if (created.error || !created.intent) {
        res
          .status(created.statusCode || 400)
          .json({ error: created.error || 'Could not create payment session.' });
        return;
      }

      res.status(201).json({
        session: sanitizeIntentForClient(created.intent, true),
      });
    } catch {
      res.status(500).json({ error: 'Failed to create payment session.' });
    }
  });

  app.get('/api/payments/sessions/by-ref/:referenceCode', async (req, res) => {
    try {
      const accessToken = extractBearerToken(req.headers.authorization);
      const result = await getPaymentSessionByReference({
        referenceCode: req.params.referenceCode,
        accessToken,
      });

      if (result.error || !result.intent) {
        res.status(result.statusCode || 404).json({ error: result.error || 'Session not found.' });
        return;
      }

      res.status(200).json({
        session: sanitizeIntentForClient(result.intent, true),
      });
    } catch {
      res.status(500).json({ error: 'Unable to resume payment session.' });
    }
  });

  app.get('/api/payments/sessions/:id', async (req, res) => {
    try {
      const intentId = req.params.id;
      const readToken =
        typeof req.query.token === 'string'
          ? req.query.token
          : typeof req.headers['x-session-token'] === 'string'
            ? req.headers['x-session-token']
            : undefined;
      const accessToken = extractBearerToken(req.headers.authorization);

      const result = await getPaymentSessionStatus({
        intentId,
        readToken,
        accessToken,
      });

      if (result.error || !result.intent) {
        res.status(result.statusCode || 404).json({ error: result.error || 'Session not found.' });
        return;
      }

      res.status(200).json({
        session: sanitizeIntentForClient(result.intent, false),
      });
    } catch {
      res.status(500).json({ error: 'Unable to read payment session status.' });
    }
  });

  app.post('/api/payments/local-webhook', async (req, res) => {
    try {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      const providedSecret =
        extractBearerToken(req.headers.authorization) ||
        (typeof req.headers['x-webhook-secret'] === 'string'
          ? req.headers['x-webhook-secret'].trim()
          : undefined);

      const result = await processLocalWebhookAlert({
        payload,
        providedSecret,
        skipSecretCheck: false,
      });

      if (!result.ok) {
        res.status(result.statusCode).json({ ok: false, error: result.error });
        return;
      }

      res.status(200).json({
        ok: true,
        matched: result.matched,
        duplicate: result.duplicate,
        amount: result.amount,
        session: result.intent ? sanitizeIntentForClient(result.intent, false) : undefined,
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Webhook processing failed.' });
    }
  });

  app.post('/api/payments/admin/engine', async (req, res) => {
    try {
      const accessToken = extractBearerToken(req.headers.authorization);
      const adminCheck = await checkAdminAccess(accessToken);
      if (!adminCheck.allowed) {
        res.status(403).json({ error: adminCheck.reason || 'Admin privileges required.' });
        return;
      }

      const rawEngine = req.body?.engine;
      if (rawEngine !== 'auto_match' && rawEngine !== 'paymongo') {
        res.status(400).json({ error: 'Invalid payment engine. Choose auto_match or paymongo.' });
        return;
      }

      const caller = accessToken ? await verifySupabaseCaller(accessToken) : null;
      const engine = await setActiveGatewayEngine(rawEngine, caller?.userId);
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || '';
      const config = await getPublicGatewayConfig(host ? `${proto}://${host}` : '');
      res.status(200).json({ ok: true, engine, config });
    } catch {
      res.status(500).json({ error: 'Failed to update gateway engine.' });
    }
  });

  app.get('/api/payments/admin/intents', async (req, res) => {
    try {
      const accessToken = extractBearerToken(req.headers.authorization);
      const adminCheck = await checkAdminAccess(accessToken);
      if (!adminCheck.allowed) {
        res.status(403).json({ error: adminCheck.reason || 'Admin privileges required.' });
        return;
      }
      const activity = await listActiveIntentsForAdmin();
      res.status(200).json(activity);
    } catch {
      res.status(500).json({ error: 'Failed to load gateway activity.' });
    }
  });

  app.post('/api/payments/admin/test-webhook', async (req, res) => {
    try {
      const accessToken = extractBearerToken(req.headers.authorization);
      const adminCheck = await checkAdminAccess(accessToken);
      if (!adminCheck.allowed) {
        res.status(403).json({ error: adminCheck.reason || 'Admin privileges required.' });
        return;
      }

      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      const result = await processLocalWebhookAlert({
        payload,
        skipSecretCheck: true,
      });

      if (!result.ok) {
        res.status(result.statusCode).json({ ok: false, error: result.error });
        return;
      }

      res.status(200).json({
        ok: true,
        matched: result.matched,
        duplicate: result.duplicate,
        amount: result.amount,
        session: result.intent ? sanitizeIntentForClient(result.intent, false) : undefined,
      });
    } catch {
      res.status(500).json({ ok: false, error: 'Admin test alert failed.' });
    }
  });

  return app;
}
