CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_username_format CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  CONSTRAINT customer_phone_length CHECK (length(phone) BETWEEN 7 AND 20)
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
