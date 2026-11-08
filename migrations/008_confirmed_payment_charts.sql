CREATE TABLE IF NOT EXISTS public.confirmed_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.products(id),
  reference text NOT NULL UNIQUE,
  amount_ngn numeric(12,2) NOT NULL CHECK (amount_ngn > 0),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS confirmed_payments_date ON public.confirmed_payments(confirmed_at DESC);
CREATE INDEX IF NOT EXISTS confirmed_payments_product_date ON public.confirmed_payments(product_id,confirmed_at DESC);
ALTER TABLE public.confirmed_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY confirmed_payments_admin_all ON public.confirmed_payments FOR ALL TO authenticated USING ((SELECT public.is_straitgate_admin())) WITH CHECK ((SELECT public.is_straitgate_admin()));
GRANT SELECT,INSERT ON public.confirmed_payments TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
