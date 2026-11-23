# mystore — Multi-Tenant Store Builder

Multi-tenant e-commerce store builder SaaS featuring 10 industry storefront templates (5 Free + 5 Pro), live branding customizer, product & variant catalog management, order tracking, and admin billing controls.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Lucide React
- **Database Blueprint (Optional Supabase Wiring):** PostgreSQL + Supabase Auth + Storage (`supabase/schema.sql`)

## Local Development

```bash
npm install
npm run dev
```

Build and type-check:

```bash
npm run lint
npm run build
```

## Deploying to Vercel via GitHub

1. Push this repository to GitHub (`.gitignore` excludes `node_modules/`, `dist/`, `.env*`, and local AI Studio scratch attachments).
2. In Vercel, click **Add New Project** and import your GitHub repository.
3. Keep the detected **Vite** preset (`Build Command: npm run build`, `Output Directory: dist`). `vercel.json` handles clean SPA routing for `/dashboard`, `/admin`, `/login`, `/shop/:slug`, and `/:slug`.
4. Add environment variables in **Project Settings -> Environment Variables** when connecting Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
5. Click **Deploy**.
