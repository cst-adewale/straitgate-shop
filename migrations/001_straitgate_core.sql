-- Applied to the Straitgate dev and production Neon branches on 2026-11-01.
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  finish text NOT NULL DEFAULT '',
  operation text NOT NULL DEFAULT '',
  price_ngn numeric(12,2),
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  item_type text NOT NULL,
  sku text UNIQUE,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  minimum_quantity numeric(12,2) NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT '',
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quote_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  address text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  installation_cost numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The Data API runs as anonymous or authenticated. Check the actual Neon Auth
-- user record rather than trusting a browser-controlled role flag.
CREATE FUNCTION public.is_straitgate_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM neon_auth."user" u
    WHERE u.id::text = auth.user_id()
      AND u.role = 'admin'
      AND COALESCE(u.banned, false) = false
  );
$$;

REVOKE ALL ON FUNCTION public.is_straitgate_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_straitgate_admin() TO authenticated;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anonymous, authenticated USING (published);
CREATE POLICY products_admin_all ON public.products
  FOR ALL TO authenticated
  USING ((SELECT public.is_straitgate_admin()))
  WITH CHECK ((SELECT public.is_straitgate_admin()));
CREATE POLICY inventory_admin_all ON public.inventory_items
  FOR ALL TO authenticated
  USING ((SELECT public.is_straitgate_admin()))
  WITH CHECK ((SELECT public.is_straitgate_admin()));
CREATE POLICY quotes_admin_all ON public.quotes
  FOR ALL TO authenticated
  USING ((SELECT public.is_straitgate_admin()))
  WITH CHECK ((SELECT public.is_straitgate_admin()));

GRANT USAGE ON SCHEMA public TO anonymous, authenticated;
GRANT SELECT ON public.products TO anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.inventory_items, public.quotes TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
