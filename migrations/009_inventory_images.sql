ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS image_keys text[] NOT NULL DEFAULT ARRAY[]::text[];
