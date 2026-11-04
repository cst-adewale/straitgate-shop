ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_data text NOT NULL DEFAULT '';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until date;
