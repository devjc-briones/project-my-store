import { createPaymentsApiApp } from '../server/app.js';

const apiApp = createPaymentsApiApp();

export default function handler(req, res) {
  if (req.url) {
    const parsed = new URL(req.url, 'http://localhost');
    const pathParam = parsed.searchParams.get('__path');
    if (
      pathParam &&
      (parsed.pathname === '/api/index' ||
        parsed.pathname === '/api' ||
        parsed.pathname === '/index' ||
        parsed.pathname === '/')
    ) {
      parsed.searchParams.delete('__path');
      const cleanPath = pathParam.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = `/api/${cleanPath}${qs ? `?${qs}` : ''}`;
    } else if (!parsed.pathname.startsWith('/api/') && parsed.pathname !== '/api') {
      req.url = `/api${parsed.pathname.startsWith('/') ? '' : '/'}${parsed.pathname}${parsed.search}`;
    }
  }
  return apiApp(req, res);
}
