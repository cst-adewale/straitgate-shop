ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS brought_by text NOT NULL DEFAULT '';
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS acquired_at timestamptz;
CREATE TABLE IF NOT EXISTS public.inventory_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  used_by text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz
);
CREATE INDEX IF NOT EXISTS inventory_usage_item_date ON public.inventory_usage(item_id,taken_at DESC);
CREATE TABLE IF NOT EXISTS public.site_visits (
  visitor_hash text NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
  visited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(visitor_hash,visit_date,visited_at)
);
CREATE INDEX IF NOT EXISTS site_visits_date ON public.site_visits(visit_date);
CREATE INDEX IF NOT EXISTS site_visits_visited_at ON public.site_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_product ON public.site_visits(product_id,visit_date);
ALTER TABLE public.inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_usage_admin_all ON public.inventory_usage FOR ALL TO authenticated USING ((SELECT public.is_straitgate_admin())) WITH CHECK ((SELECT public.is_straitgate_admin()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.inventory_usage TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_settings_admin_all ON public.admin_settings FOR ALL TO authenticated USING ((SELECT public.is_straitgate_admin())) WITH CHECK ((SELECT public.is_straitgate_admin()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.admin_settings TO authenticated;
