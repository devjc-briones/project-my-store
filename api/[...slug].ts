import { createPaymentsApiApp } from '../server/app.js';

const apiApp = createPaymentsApiApp();

export default function handler(req: any, res: any) {
  return apiApp(req, res);
}

