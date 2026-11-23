-- ============================================================================
-- Supabase PostgreSQL Schema Blueprint (Audited & Production-Hardened)
-- Coordinated Admin, Seller, Buyer & Guest Storefront Architecture
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. ROLES LOOKUP TABLE (1 = admin, 2 = seller, 3 = buyer)
-- ============================================================================
create table if not exists public.roles (
  id smallint primary key,
  name text not null unique check (name in ('admin', 'seller', 'buyer')),
  description text
);

insert into public.roles (id, name, description) values
  (1, 'admin', 'Platform administrator'),
  (2, 'seller', 'Store owner and merchant'),
  (3, 'buyer', 'Customer and shopper')
on conflict (id) do nothing;

-- ============================================================================
-- 2. USERS TABLE (1-to-1 with auth.users, nullable buyer Information Settings)
-- ============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id smallint not null default 3 references public.roles(id),
  name text not null check (char_length(trim(name)) >= 2),
  email text not null unique,
  avatar_url text,

  -- Moderation & merchant billing status
  status text not null default 'active' check (status in ('active', 'restricted')),
  restricted_reason text,
  plan text not null default 'starter' check (plan in ('starter', 'pro')),
  plan_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,

  -- Nullable Buyer "Information Settings" (not required for Admin / Seller)
  phone_number text,
  address text,
  delivery_notes text,
  preferred_payment_method text check (
    preferred_payment_method is null
    or preferred_payment_method in ('gcash', 'maya', 'bank', 'cod')
  ),
  checkout_info_updated_at timestamptz,

  last_active_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role_id on public.users(role_id);
create index if not exists idx_users_plan on public.users(plan);

-- ============================================================================
-- 3. STORES TABLE (Includes Template Selection & Saved UI Customizer Settings)
-- ============================================================================
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null,
  domain_url text generated always as ('mystore.com/' || lower(slug)) stored,
  template_id text not null default 'food-restaurant' check (
    template_id in (
      'food-restaurant', 'cafe-drinks', 'clothing-apparel',
      'footwear-shoes', 'gadgets-accessories',
      'food-bistro-pro', 'cafe-atelier-pro', 'clothing-editorial-pro',
      'footwear-studio-pro', 'gadgets-flagship-pro'
    )
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'restricted')),
  restricted_reason text,

  -- Storefront UI & Branding Theme Settings
  primary_color text not null default '#0F172A',
  secondary_color text not null default '#334155',
  accent_color text not null default '#1D4ED8',
  surface_color text not null default '#F8FAFC',
  text_color text not null default '#0F172A',
  background_mode text not null default 'light' check (background_mode in ('light', 'cream', 'dark')),
  button_style text not null default 'rounded' check (button_style in ('rounded', 'pill', 'sharp')),
  font_pairing text not null default 'modern-sans' check (
    font_pairing in ('modern-sans', 'editorial-serif', 'bold-display', 'athletic-condensed', 'minimal-mono')
  ),

  -- Storefront Copy, Assets & Footer Info
  logo_text text not null default '',
  logo_image_url text,
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_cta_label text not null default 'Shop Now',
  hero_banner_url text,
  bio text not null default '',
  announcement_enabled boolean not null default false,
  announcement_text text not null default '',
  contact_address text,
  contact_number text,
  social_instagram text,
  social_facebook text,
  social_tiktok text,
  social_website text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_stores_slug_lower on public.stores (lower(slug));
create index if not exists idx_stores_user_id on public.stores(user_id);

-- Link buyers to the storefront where they registered (powers Admin Users/Stores counts)
alter table public.users
  add column if not exists registered_store_id uuid references public.stores(id) on delete set null;

create index if not exists idx_users_registered_store_id on public.users(registered_store_id);

-- ============================================================================
-- 4. STORE_PRODUCTS & STORE_PRODUCT_VARIANTS
--    Note: id is PK, store_id is FK -> stores(id) so each store can have many products.
-- ============================================================================
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text not null default '',
  category text not null default 'General',
  sku text not null,
  base_price numeric(12, 2) not null check (base_price >= 0),
  discount_type text not null default 'none' check (discount_type in ('none', 'percentage', 'fixed')),
  discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 95),
  cost_price numeric(12, 2) check (cost_price is null or cost_price >= 0),
  final_price numeric(12, 2) not null check (final_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  is_featured boolean not null default false,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);

create index if not exists idx_store_products_store_id on public.store_products(store_id);
create index if not exists idx_store_products_store_available on public.store_products(store_id, is_available);

create table if not exists public.store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  label text not null,
  attribute_name text not null default 'Option',
  value text not null,
  price_delta numeric(12, 2) not null default 0,
  stock integer not null default 0 check (stock >= 0),
  sku text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_product_variants_product_id on public.store_product_variants(product_id);

-- ============================================================================
-- 5. STORE_CHECKOUT_SETTINGS & STORE_PAYMENTS_SETTINGS
-- ============================================================================
-- 5A. Store-wide order calculation & currency rules (1 row per store)
create table if not exists public.store_checkout_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  currency text not null default 'PHP' check (currency in ('PHP', 'USD', 'SGD', 'EUR')),
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  free_shipping_threshold numeric(12, 2) not null default 0 check (free_shipping_threshold >= 0),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent >= 0 and tax_percent <= 100),
  service_charge_percent numeric(5, 2) not null default 0 check (service_charge_percent >= 0 and service_charge_percent <= 100),
  updated_at timestamptz not null default now()
);

-- 5B. Store Payment Methods per Store (rows: maya, gcash, bank, cod -> FK to stores)
create table if not exists public.store_payments_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  method_key text not null check (method_key in ('gcash', 'maya', 'bank', 'cod')),
  is_enabled boolean not null default false,
  bank_name text,
  account_name text,
  account_number text,
  instructions text,
  qr_image_url text,
  updated_at timestamptz not null default now(),
  unique (store_id, method_key)
);

create index if not exists idx_store_payments_settings_store_id on public.store_payments_settings(store_id);

-- ============================================================================
-- 6. BUYER_ORDERS, ORDER_ITEMS & STORE_PRODUCT_PAYMENTS
-- ============================================================================
create table if not exists public.buyer_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,

  -- Snapshot of customer details at checkout
  customer_name text not null,
  phone_number text not null,
  delivery_address text not null,
  notes text,

  -- Order calculation breakdown
  currency text not null default 'PHP' check (currency in ('PHP', 'USD', 'SGD', 'EUR')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  service_charge_amount numeric(12, 2) not null default 0 check (service_charge_amount >= 0),
  grand_total numeric(12, 2) not null check (grand_total >= 0),

  -- Matches 4 Order Tracking tabs: Pending, Preparing, Out for Delivery, Completed
  status text not null default 'Pending' check (
    status in ('Pending', 'Preparing', 'Out for Delivery', 'Completed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_buyer_orders_user_status on public.buyer_orders(user_id, status, created_at desc);
create index if not exists idx_buyer_orders_store_status on public.buyer_orders(store_id, status, created_at desc);
create index if not exists idx_buyer_orders_store_code on public.buyer_orders(store_id, order_code);

-- Ordered products inside each buyer order (FK to buyer_orders & store_products)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.buyer_orders(id) on delete cascade,
  store_product_id uuid references public.store_products(id) on delete set null,
  variant_id uuid references public.store_product_variants(id) on delete set null,
  product_name text not null,
  variant_label text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(store_product_id);

-- Separated Payment Status & Proof table for Buyer Orders & Ordered Products
create table if not exists public.store_product_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.buyer_orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  store_payment_setting_id uuid references public.store_payments_settings(id) on delete set null,
  store_product_id uuid references public.store_products(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,

  method_key text not null check (method_key in ('gcash', 'maya', 'bank', 'cod')),
  method_label text not null,
  payment_status text not null default 'unpaid' check (
    payment_status in ('unpaid', 'pending_verification', 'paid', 'refunded')
  ),
  currency text not null default 'PHP' check (currency in ('PHP', 'USD', 'SGD', 'EUR')),
  amount_due numeric(12, 2) not null check (amount_due >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  reference_number text,
  payment_proof_url text,
  paid_at timestamptz,
  verified_by uuid references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_product_payments_order_id on public.store_product_payments(order_id);
create index if not exists idx_store_product_payments_store_status on public.store_product_payments(store_id, payment_status, created_at desc);
create index if not exists idx_store_product_payments_user_id on public.store_product_payments(user_id, created_at desc);

-- Security-invoker view combining payment status + order status + ordered products list
create or replace view public.v_store_product_payments_detail
with (security_invoker = true) as
select
  spp.id as payment_id,
  spp.order_id,
  bo.order_code,
  spp.store_id,
  spp.user_id,
  bo.customer_name,
  spp.method_key,
  spp.method_label,
  spp.payment_status,
  spp.amount_due,
  spp.amount_paid,
  spp.payment_proof_url,
  spp.paid_at,
  bo.status as fulfillment_status,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order_item_id', oi.id,
        'store_product_id', oi.store_product_id,
        'product_name', oi.product_name,
        'variant_label', oi.variant_label,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total
      )
    ) filter (where oi.id is not null),
    '[]'::jsonb
  ) as ordered_products,
  spp.created_at
from public.store_product_payments spp
join public.buyer_orders bo on bo.id = spp.order_id
left join public.order_items oi on oi.order_id = bo.id
group by spp.id, bo.id;

-- ============================================================================
-- 7. SUBSCRIPTIONS, PLATFORM PAYMENT CHANNELS & NOTIFICATIONS
-- ============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'pro')),
  amount numeric(12, 2) not null check (amount >= 0),
  payment_method text not null,
  status text not null default 'pending' check (status in ('pending', 'dues', 'paid', 'refunded')),
  due_date timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  proof_url text,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_status on public.subscriptions(user_id, status, created_at desc);

create table if not exists public.platform_payment_channels (
  id text primary key,
  channel_type text not null check (channel_type in ('ewallet', 'bank', 'custom')),
  label text not null,
  subtitle text not null default '',
  is_enabled boolean not null default true,
  requires_receipt boolean not null default true,
  account_name text not null,
  number_label text not null default 'Account Number',
  account_number text not null,
  note text,
  qr_image_url text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed default platform payment channels matching src/data/platformPayments.ts
insert into public.platform_payment_channels (
  id, channel_type, label, subtitle, is_enabled, requires_receipt,
  account_name, number_label, account_number, note, sort_order
) values
  (
    'gcash', 'ewallet', 'GCash', 'Scan QR or send via e-wallet', true, true,
    'mystore Platform Billing', 'GCash Number', '0917 888 2410',
    'Scan the QR code or send exact amount, then upload your receipt.', 1
  ),
  (
    'maya', 'ewallet', 'Maya', 'Instant Maya QR transfer', true, true,
    'mystore Platform Billing', 'Maya Number', '0918 555 9034',
    'Send exact subscription amount and attach payment screenshot.', 2
  ),
  (
    'bank', 'bank', 'Bank Transfer', 'UnionBank / InstaPay / PESONet', true, true,
    'mystore Technologies Inc.', 'UnionBank Account Number', '1094 2201 7745',
    'Bank: UnionBank of the Philippines · Instant InstaPay transfer.', 3
  )
on conflict (id) do nothing;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_dismissed, is_read, created_at desc);

-- Tracks read/dismissed keys for derived dashboard notifications (matches DashboardHeader.tsx)
create table if not exists public.user_notification_states (
  user_id uuid not null references public.users(id) on delete cascade,
  notification_key text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);

-- ============================================================================
-- 8. HELPER FUNCTIONS, SECURITY TRIGGERS & ORDER RPCS
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists trg_stores_updated_at on public.stores;
create trigger trg_stores_updated_at before update on public.stores for each row execute function public.set_updated_at();

drop trigger if exists trg_store_products_updated_at on public.store_products;
create trigger trg_store_products_updated_at before update on public.store_products for each row execute function public.set_updated_at();

drop trigger if exists trg_store_checkout_settings_updated_at on public.store_checkout_settings;
create trigger trg_store_checkout_settings_updated_at before update on public.store_checkout_settings for each row execute function public.set_updated_at();

drop trigger if exists trg_store_payments_settings_updated_at on public.store_payments_settings;
create trigger trg_store_payments_settings_updated_at before update on public.store_payments_settings for each row execute function public.set_updated_at();

drop trigger if exists trg_buyer_orders_updated_at on public.buyer_orders;
create trigger trg_buyer_orders_updated_at before update on public.buyer_orders for each row execute function public.set_updated_at();

drop trigger if exists trg_store_product_payments_updated_at on public.store_product_payments;
create trigger trg_store_product_payments_updated_at before update on public.store_product_payments for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_channels_updated_at on public.platform_payment_channels;
create trigger trg_platform_channels_updated_at before update on public.platform_payment_channels for each row execute function public.set_updated_at();

drop trigger if exists trg_user_notification_states_updated_at on public.user_notification_states;
create trigger trg_user_notification_states_updated_at before update on public.user_notification_states for each row execute function public.set_updated_at();

create or replace function public.current_user_role_id()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select role_id from public.users where id = auth.uid();
$$;

create or replace function public.is_store_billing_closed(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    join public.users u on u.id = s.user_id
    where s.id = target_store_id
      and s.status = 'published'
      and u.role_id <> 1
      and u.plan <> 'starter'
      and coalesce(u.cancel_at_period_end, false) = false
      and u.plan_period_ends_at is not null
      and now() >= u.plan_period_ends_at
  );
$$;

create or replace function public.is_store_publicly_open(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stores s
    join public.users u on u.id = s.user_id
    where s.id = target_store_id
      and s.status = 'published'
      and u.status = 'active'
      and (
        u.plan = 'starter'
        or u.role_id = 1
        or u.cancel_at_period_end = true
        or u.plan_period_ends_at is null
        or now() < u.plan_period_ends_at
      )
  );
$$;

-- Trigger 1: Auto-create public.users row when auth.users is created (never self-assign Admin)
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role smallint;
  raw_store_id text;
  valid_store_id uuid := null;
begin
  requested_role := case
    when (new.raw_user_meta_data ->> 'account_type') = 'seller' then 2
    else 3
  end;

  raw_store_id := nullif(trim(new.raw_user_meta_data ->> 'registered_store_id'), '');
  if requested_role = 3 and raw_store_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into valid_store_id from public.stores where id = raw_store_id::uuid limit 1;
  end if;

  insert into public.users (id, role_id, name, email, avatar_url, registered_store_id)
  values (
    new.id,
    requested_role,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    valid_store_id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Trigger 1B: Prevent non-admin users from self-updating privileged billing/moderation fields
create or replace function public.protect_user_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bypass_user_protection', true) = 'true' then
    return new;
  end if;

  if auth.uid() is not null and coalesce(public.current_user_role_id(), 3) <> 1 then
    if new.role_id is distinct from old.role_id
      or new.status is distinct from old.status
      or new.restricted_reason is distinct from old.restricted_reason
      or new.plan is distinct from old.plan
      or new.plan_period_ends_at is distinct from old.plan_period_ends_at
      or new.email is distinct from old.email
    then
      raise exception 'Permission denied: only administrators may modify role, status, email, or plan period fields.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_user_privileged_columns on public.users;
create trigger trg_protect_user_privileged_columns
  before update on public.users
  for each row execute function public.protect_user_privileged_columns();

-- Trigger 2: Seed store_checkout_settings + 4 rows in store_payments_settings for new stores
create or replace function public.handle_new_store_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_checkout_settings (store_id) values (new.id)
  on conflict (store_id) do nothing;

  insert into public.store_payments_settings (store_id, method_key, is_enabled) values
    (new.id, 'cod', true),
    (new.id, 'gcash', false),
    (new.id, 'maya', false),
    (new.id, 'bank', false)
  on conflict (store_id, method_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_store_seed_payments on public.stores;
create trigger trg_store_seed_payments
  after insert on public.stores
  for each row execute function public.handle_new_store_defaults();

-- Trigger 3: Enforce Starter vs Pro store limit (1 vs 15) & Pro template guard
create or replace function public.enforce_store_plan_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_plan text;
  owner_role smallint;
  existing_count integer;
begin
  select plan, role_id into owner_plan, owner_role from public.users where id = new.user_id;

  if owner_role <> 1 and owner_plan = 'starter' then
    if tg_op = 'INSERT' then
      select count(*) into existing_count from public.stores where user_id = new.user_id;
      if existing_count >= 1 then
        raise exception 'Starter plan is limited to 1 store. Upgrade to Pro for up to 15 stores.';
      end if;
    end if;

    if (tg_op = 'INSERT' or new.template_id is distinct from old.template_id) and new.template_id like '%-pro' then
      raise exception 'Pro plan required to use Pro storefront templates.';
    end if;
  elsif owner_role <> 1 and owner_plan = 'pro' and tg_op = 'INSERT' then
    select count(*) into existing_count from public.stores where user_id = new.user_id;
    if existing_count >= 15 then
      raise exception 'Pro plan limit reached (15 stores max).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_store_limits on public.stores;
create trigger trg_enforce_store_limits
  before insert or update on public.stores
  for each row execute function public.enforce_store_plan_limits();

-- Trigger 4A: Ensure store_products.sku is always trimmed & collision-safe if left blank
create or replace function public.handle_product_sku_default()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sku is null or char_length(trim(new.sku)) = 0 then
    new.sku := 'PRD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  else
    new.sku := trim(new.sku);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_sku_default on public.store_products;
create trigger trg_product_sku_default
  before insert or update on public.store_products
  for each row execute function public.handle_product_sku_default();

-- Trigger 4B: Enforce Starter product limit (25 products per store in store_products)
create or replace function public.enforce_product_plan_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_plan text;
  owner_role smallint;
  existing_count integer;
begin
  select u.plan, u.role_id into owner_plan, owner_role
  from public.stores s
  join public.users u on u.id = s.user_id
  where s.id = new.store_id;

  if owner_role <> 1 and owner_plan = 'starter' then
    select count(*) into existing_count from public.store_products where store_id = new.store_id;
    if existing_count >= 25 then
      raise exception 'Starter plan is limited to 25 products per store.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_product_limits on public.store_products;
create trigger trg_enforce_product_limits
  before insert on public.store_products
  for each row execute function public.enforce_product_plan_limits();

-- Trigger 5: Automatically sync public.users plan & period when Admin approves a subscription
create or replace function public.handle_subscription_status_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_period_end timestamptz;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.period_start := coalesce(new.period_start, now());
    next_period_end := coalesce(new.period_end, now() + interval '30 days');
    new.period_end := next_period_end;

    perform set_config('app.bypass_user_protection', 'true', true);
    update public.users
    set
      plan = new.plan_id,
      plan_period_ends_at = case when new.plan_id = 'pro' then next_period_end else null end,
      cancel_at_period_end = false,
      status = case
        when status = 'restricted' and coalesce(restricted_reason, '') like '%Subscription billing%' then 'active'
        else status
      end,
      restricted_reason = case
        when status = 'restricted' and coalesce(restricted_reason, '') like '%Subscription billing%' then null
        else restricted_reason
      end
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_subscription_status_sync on public.subscriptions;
create trigger trg_subscription_status_sync
  before insert or update on public.subscriptions
  for each row execute function public.handle_subscription_status_sync();

-- RPC 1: Atomic Storefront Checkout (Supports both Authenticated Buyers AND Guests)
create or replace function public.place_storefront_order(
  p_store_id uuid,
  p_customer_name text,
  p_phone_number text,
  p_delivery_address text,
  p_method_key text,
  p_items jsonb,
  p_notes text default null,
  p_reference_number text default null,
  p_payment_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_checkout public.store_checkout_settings%rowtype;
  v_payment_setting public.store_payments_settings%rowtype;
  v_item jsonb;
  v_product public.store_products%rowtype;
  v_variant public.store_product_variants%rowtype;
  v_qty integer;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_delivery_fee numeric(12, 2) := 0;
  v_tax_amount numeric(12, 2) := 0;
  v_service_charge numeric(12, 2) := 0;
  v_grand_total numeric(12, 2) := 0;
  v_order_id uuid;
  v_order_code text;
  v_method_label text;
  v_payment_status text;
  v_first_product_id uuid := null;
  v_first_order_item_id uuid := null;
  v_inserted_item_id uuid;
begin
  if not public.is_store_publicly_open(p_store_id) then
    raise exception 'This store is not currently accepting orders.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart cannot be empty.';
  end if;

  if char_length(trim(coalesce(p_customer_name, ''))) < 2
    or char_length(trim(coalesce(p_phone_number, ''))) < 5
    or char_length(trim(coalesce(p_delivery_address, ''))) < 5 then
    raise exception 'Customer name, phone number, and delivery address are required.';
  end if;

  select * into v_payment_setting
  from public.store_payments_settings
  where store_id = p_store_id and method_key = p_method_key and is_enabled = true;

  if not found then
    raise exception 'Selected payment method (%) is not enabled for this store.', p_method_key;
  end if;

  if p_method_key <> 'cod' and char_length(trim(coalesce(p_payment_proof_url, ''))) = 0 then
    raise exception 'Payment proof screenshot is required for online payment.';
  end if;

  select * into v_checkout from public.store_checkout_settings where store_id = p_store_id;

  -- Compute authoritative subtotal first
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Invalid item quantity.';
    end if;

    select * into v_product
    from public.store_products
    where id = (v_item ->> 'store_product_id')::uuid
      and store_id = p_store_id
      and is_available = true;

    if not found then
      raise exception 'One or more products are no longer available.';
    end if;

    v_unit_price := v_product.final_price;
    if nullif(trim(coalesce(v_item ->> 'variant_id', '')), '') is not null then
      select * into v_variant
      from public.store_product_variants
      where id = (v_item ->> 'variant_id')::uuid and product_id = v_product.id;
      if found then
        v_unit_price := greatest(0, v_product.final_price + v_variant.price_delta);
      end if;
    elsif nullif(trim(coalesce(v_item ->> 'variant_label', '')), '') is not null then
      select * into v_variant
      from public.store_product_variants
      where product_id = v_product.id and label = (v_item ->> 'variant_label')
      limit 1;
      if found then
        v_unit_price := greatest(0, v_product.final_price + v_variant.price_delta);
      end if;
    end if;

    v_subtotal := v_subtotal + round(v_unit_price * v_qty, 2);
  end loop;

  v_delivery_fee := case
    when coalesce(v_checkout.free_shipping_threshold, 0) > 0 and v_subtotal >= v_checkout.free_shipping_threshold then 0
    else coalesce(v_checkout.shipping_fee, 0)
  end;
  v_tax_amount := round(v_subtotal * (coalesce(v_checkout.tax_percent, 0) / 100.0), 2);
  v_service_charge := round(v_subtotal * (coalesce(v_checkout.service_charge_percent, 0) / 100.0), 2);
  v_grand_total := round(v_subtotal + v_delivery_fee + v_tax_amount + v_service_charge, 2);

  v_order_code := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.buyer_orders (
    order_code, store_id, user_id,
    customer_name, phone_number, delivery_address, notes,
    currency, subtotal, delivery_fee, tax_amount, service_charge_amount, grand_total, status
  ) values (
    v_order_code, p_store_id, v_user_id,
    trim(p_customer_name), trim(p_phone_number), trim(p_delivery_address), nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(v_checkout.currency, 'PHP'), v_subtotal, v_delivery_fee, v_tax_amount, v_service_charge, v_grand_total, 'Pending'
  )
  returning id into v_order_id;

  -- Insert order line items & safely decrement stock
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    select * into v_product from public.store_products where id = (v_item ->> 'store_product_id')::uuid;

    v_unit_price := v_product.final_price;
    v_variant.id := null;
    v_variant.label := nullif(trim(coalesce(v_item ->> 'variant_label', '')), '');

    if nullif(trim(coalesce(v_item ->> 'variant_id', '')), '') is not null then
      select * into v_variant
      from public.store_product_variants
      where id = (v_item ->> 'variant_id')::uuid and product_id = v_product.id;
      if found then
        v_unit_price := greatest(0, v_product.final_price + v_variant.price_delta);
      end if;
    elsif v_variant.label is not null then
      select * into v_variant
      from public.store_product_variants
      where product_id = v_product.id and label = v_variant.label
      limit 1;
      if found then
        v_unit_price := greatest(0, v_product.final_price + v_variant.price_delta);
      end if;
    end if;

    v_line_total := round(v_unit_price * v_qty, 2);

    insert into public.order_items (
      order_id, store_product_id, variant_id, product_name, variant_label, quantity, unit_price, line_total
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.label, v_qty, v_unit_price, v_line_total
    )
    returning id into v_inserted_item_id;

    if v_first_product_id is null then
      v_first_product_id := v_product.id;
      v_first_order_item_id := v_inserted_item_id;
    end if;

    update public.store_products
    set stock = greatest(0, stock - v_qty)
    where id = v_product.id;

    if v_variant.id is not null then
      update public.store_product_variants
      set stock = greatest(0, stock - v_qty)
      where id = v_variant.id;
    end if;
  end loop;

  v_method_label := case p_method_key
    when 'gcash' then 'GCash'
    when 'maya' then 'Maya'
    when 'bank' then 'Bank Transfer'
    else 'Cash on Delivery (COD)'
  end;

  v_payment_status := case
    when p_method_key = 'cod' then 'unpaid'
    else 'pending_verification'
  end;

  insert into public.store_product_payments (
    order_id, store_id, user_id, store_payment_setting_id, store_product_id, order_item_id,
    method_key, method_label, payment_status, currency, amount_due, amount_paid,
    reference_number, payment_proof_url
  ) values (
    v_order_id, p_store_id, v_user_id, v_payment_setting.id, v_first_product_id, v_first_order_item_id,
    p_method_key, v_method_label, v_payment_status, coalesce(v_checkout.currency, 'PHP'),
    v_grand_total, 0, nullif(trim(coalesce(p_reference_number, '')), ''), nullif(trim(coalesce(p_payment_proof_url, '')), '')
  );

  return jsonb_build_object(
    'id', v_order_id,
    'order_code', v_order_code,
    'store_id', p_store_id,
    'status', 'Pending',
    'payment_status', v_payment_status,
    'currency', coalesce(v_checkout.currency, 'PHP'),
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'tax_amount', v_tax_amount,
    'service_charge_amount', v_service_charge,
    'grand_total', v_grand_total,
    'created_at', now()
  );
end;
$$;

-- RPC 2: Safe Guest/Buyer Order Tracking Lookup by Order Code + Store
create or replace function public.track_storefront_order(
  p_store_id uuid,
  p_order_code text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', bo.id,
    'order_code', bo.order_code,
    'store_id', bo.store_id,
    'customer_name', bo.customer_name,
    'status', bo.status,
    'currency', bo.currency,
    'subtotal', bo.subtotal,
    'delivery_fee', bo.delivery_fee,
    'tax_amount', bo.tax_amount,
    'service_charge_amount', bo.service_charge_amount,
    'grand_total', bo.grand_total,
    'payment_method', spp.method_label,
    'payment_status', spp.payment_status,
    'created_at', bo.created_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'store_product_id', oi.store_product_id,
            'product_name', oi.product_name,
            'variant_label', oi.variant_label,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'line_total', oi.line_total
          )
        )
        from public.order_items oi
        where oi.order_id = bo.id
      ),
      '[]'::jsonb
    )
  )
  from public.buyer_orders bo
  left join public.store_product_payments spp on spp.order_id = bo.id
  where bo.store_id = p_store_id
    and upper(bo.order_code) = upper(trim(p_order_code))
  limit 1;
$$;

grant execute on function public.place_storefront_order(uuid, text, text, text, text, jsonb, text, text, text) to anon, authenticated;
grant execute on function public.track_storefront_order(uuid, text) to anon, authenticated;
grant execute on function public.is_store_billing_closed(uuid) to anon, authenticated;
grant execute on function public.is_store_publicly_open(uuid) to anon, authenticated;

-- ============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_variants enable row level security;
alter table public.store_checkout_settings enable row level security;
alter table public.store_payments_settings enable row level security;
alter table public.buyer_orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_product_payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.platform_payment_channels enable row level security;
alter table public.notifications enable row level security;
alter table public.user_notification_states enable row level security;

drop policy if exists "roles_select_all" on public.roles;
create policy "roles_select_all" on public.roles for select using (true);

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select using (id = auth.uid() or public.current_user_role_id() = 1);

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "users_admin_all" on public.users;
create policy "users_admin_all" on public.users
  for all using (public.current_user_role_id() = 1);

-- Public visitors can load published or restricted store shells (so "Temporarily Closed" or
-- "Storefront Restricted" views render properly), while drafts remain owner/admin-only.
drop policy if exists "stores_select_public_or_owner" on public.stores;
create policy "stores_select_public_or_owner" on public.stores
  for select using (
    status in ('published', 'restricted')
    or user_id = auth.uid()
    or public.current_user_role_id() = 1
  );

drop policy if exists "stores_owner_insert" on public.stores;
create policy "stores_owner_insert" on public.stores
  for insert with check (user_id = auth.uid() and public.current_user_role_id() in (1, 2));

drop policy if exists "stores_owner_manage" on public.stores;
create policy "stores_owner_manage" on public.stores
  for all using (user_id = auth.uid() or public.current_user_role_id() = 1);

-- Catalog & Checkout rules strictly gated by is_store_publicly_open(store_id)
drop policy if exists "store_products_select" on public.store_products;
create policy "store_products_select" on public.store_products
  for select using (
    (is_available = true and public.is_store_publicly_open(store_id))
    or exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_products_owner" on public.store_products;
create policy "store_products_owner" on public.store_products
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_product_variants_select" on public.store_product_variants;
create policy "store_product_variants_select" on public.store_product_variants
  for select using (
    exists (
      select 1 from public.store_products p
      where p.id = product_id
        and (
          (p.is_available = true and public.is_store_publicly_open(p.store_id))
          or exists (select 1 from public.stores s where s.id = p.store_id and s.user_id = auth.uid())
          or public.current_user_role_id() = 1
        )
    )
  );

drop policy if exists "store_product_variants_owner" on public.store_product_variants;
create policy "store_product_variants_owner" on public.store_product_variants
  for all using (
    exists (
      select 1 from public.store_products p
      join public.stores s on s.id = p.store_id
      where p.id = product_id and s.user_id = auth.uid()
    )
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_checkout_settings_select" on public.store_checkout_settings;
create policy "store_checkout_settings_select" on public.store_checkout_settings
  for select using (
    public.is_store_publicly_open(store_id)
    or exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_checkout_settings_owner" on public.store_checkout_settings;
create policy "store_checkout_settings_owner" on public.store_checkout_settings
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_payments_settings_select" on public.store_payments_settings;
create policy "store_payments_settings_select" on public.store_payments_settings
  for select using (
    (is_enabled = true and public.is_store_publicly_open(store_id))
    or exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_payments_settings_owner" on public.store_payments_settings;
create policy "store_payments_settings_owner" on public.store_payments_settings
  for all using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "buyer_orders_select" on public.buyer_orders;
create policy "buyer_orders_select" on public.buyer_orders
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "buyer_orders_insert" on public.buyer_orders;
create policy "buyer_orders_insert" on public.buyer_orders
  for insert with check (
    user_id = auth.uid()
    and public.is_store_publicly_open(store_id)
  );

drop policy if exists "buyer_orders_seller_update" on public.buyer_orders;
create policy "buyer_orders_seller_update" on public.buyer_orders
  for update using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items
  for select using (
    exists (
      select 1 from public.buyer_orders o
      where o.id = order_id
        and (
          o.user_id = auth.uid()
          or exists (select 1 from public.stores s where s.id = o.store_id and s.user_id = auth.uid())
          or public.current_user_role_id() = 1
        )
    )
  );

drop policy if exists "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.buyer_orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists "store_product_payments_select" on public.store_product_payments;
create policy "store_product_payments_select" on public.store_product_payments
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "store_product_payments_insert" on public.store_product_payments;
create policy "store_product_payments_insert" on public.store_product_payments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.buyer_orders o
      where o.id = order_id and o.user_id = auth.uid() and o.store_id = store_id
    )
  );

drop policy if exists "store_product_payments_seller_update" on public.store_product_payments;
create policy "store_product_payments_seller_update" on public.store_product_payments
  for update using (
    exists (select 1 from public.stores s where s.id = store_id and s.user_id = auth.uid())
    or public.current_user_role_id() = 1
  );

drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions
  for select using (user_id = auth.uid() or public.current_user_role_id() = 1);

drop policy if exists "subscriptions_seller_insert" on public.subscriptions;
create policy "subscriptions_seller_insert" on public.subscriptions
  for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "subscriptions_admin_update" on public.subscriptions;
create policy "subscriptions_admin_update" on public.subscriptions
  for update using (public.current_user_role_id() = 1);

drop policy if exists "platform_channels_select" on public.platform_payment_channels;
create policy "platform_channels_select" on public.platform_payment_channels
  for select using (is_enabled = true or public.current_user_role_id() = 1);

drop policy if exists "platform_channels_admin" on public.platform_payment_channels;
create policy "platform_channels_admin" on public.platform_payment_channels
  for all using (public.current_user_role_id() = 1);

drop policy if exists "notifications_owner" on public.notifications;
create policy "notifications_owner" on public.notifications
  for all using (user_id = auth.uid() or public.current_user_role_id() = 1);

drop policy if exists "user_notification_states_owner" on public.user_notification_states;
create policy "user_notification_states_owner" on public.user_notification_states
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- 10. SUPABASE STORAGE BUCKETS & POLICIES
-- ============================================================================
insert into storage.buckets (id, name, public) values
  ('store-assets', 'store-assets', true),
  ('product-images', 'product-images', true),
  ('payment-qr-codes', 'payment-qr-codes', true),
  ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "public_read_store_media" on storage.objects;
create policy "public_read_store_media" on storage.objects
  for select using (bucket_id in ('store-assets', 'product-images', 'payment-qr-codes'));

drop policy if exists "auth_upload_own_folder" on storage.objects;
create policy "auth_upload_own_folder" on storage.objects
  for insert with check (
    auth.role() = 'authenticated'
    and bucket_id in ('store-assets', 'product-images', 'payment-qr-codes', 'payment-proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "auth_update_own_folder" on storage.objects;
create policy "auth_update_own_folder" on storage.objects
  for update using (
    auth.role() = 'authenticated'
    and bucket_id in ('store-assets', 'product-images', 'payment-qr-codes', 'payment-proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "auth_manage_own_folder" on storage.objects;
create policy "auth_manage_own_folder" on storage.objects
  for delete using (
    auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow unauthenticated guest checkout to upload a receipt only into payment-proofs/guests/<uuid>.ext
-- (Insert-only; guests cannot overwrite or list objects in payment-proofs)
drop policy if exists "guest_upload_payment_proofs" on storage.objects;
create policy "guest_upload_payment_proofs" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = 'guests'
  );

drop policy if exists "private_read_payment_proofs" on storage.objects;
create policy "private_read_payment_proofs" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role_id() = 1
      or exists (
        select 1 from public.store_product_payments spp
        join public.stores s on s.id = spp.store_id
        where (
          spp.payment_proof_url = storage.objects.name
          or spp.payment_proof_url like '%' || storage.objects.name
        )
          and s.user_id = auth.uid()
      )
    )
  );
