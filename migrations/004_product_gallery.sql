ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_keys text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS main_image_index integer NOT NULL DEFAULT 0;
UPDATE public.products SET image_keys = ARRAY[image_key] WHERE image_key <> '' AND cardinality(image_keys) = 0;
