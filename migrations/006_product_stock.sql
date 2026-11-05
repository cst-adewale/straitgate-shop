ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_quantity_nonnegative
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0);
