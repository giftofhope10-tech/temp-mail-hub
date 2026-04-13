
-- API keys table for developer access
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text UNIQUE NOT NULL,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  allowed_domains text[] NOT NULL DEFAULT ARRAY['kameti.online']::text[],
  rate_limit_per_minute int NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- API usage tracking for rate limiting
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Policies for api_keys
CREATE POLICY "Anyone can read api_keys" ON public.api_keys FOR SELECT USING (true);
CREATE POLICY "Anyone can insert api_keys" ON public.api_keys FOR INSERT WITH CHECK (true);

-- Policies for api_usage
CREATE POLICY "Anyone can read api_usage" ON public.api_usage FOR SELECT USING (true);
CREATE POLICY "Anyone can insert api_usage" ON public.api_usage FOR INSERT WITH CHECK (true);

-- Update temp_emails expiry to 24 hours
ALTER TABLE public.temp_emails ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Function to clean up expired temp emails and their received emails
CREATE OR REPLACE FUNCTION public.cleanup_expired_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.received_emails WHERE temp_email_id IN (
    SELECT id FROM public.temp_emails WHERE expires_at < now()
  );
  DELETE FROM public.temp_emails WHERE expires_at < now();
END;
$$;
