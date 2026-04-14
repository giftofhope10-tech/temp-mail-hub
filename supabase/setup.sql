-- TempMail Schema Setup
-- Run this in: https://supabase.com/dashboard/project/lwsrdqpxnlrzjqucbdwt/sql/new

CREATE TABLE IF NOT EXISTS public.temp_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS public.received_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temp_email_id UUID NOT NULL REFERENCES public.temp_emails(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  subject TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text UNIQUE NOT NULL,
  email text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  allowed_domains text[] NOT NULL DEFAULT ARRAY['kameti.online']::text[],
  rate_limit_per_minute int NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_received_emails_temp_id ON public.received_emails(temp_email_id);
CREATE INDEX IF NOT EXISTS idx_temp_emails_address ON public.temp_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_temp_emails_expires ON public.temp_emails(expires_at);

ALTER TABLE public.temp_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Policies (allow service_role to do everything)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='temp_emails' AND policyname='allow_all_temp_emails') THEN
    CREATE POLICY "allow_all_temp_emails" ON public.temp_emails USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='received_emails' AND policyname='allow_all_received_emails') THEN
    CREATE POLICY "allow_all_received_emails" ON public.received_emails USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_keys' AND policyname='allow_all_api_keys') THEN
    CREATE POLICY "allow_all_api_keys" ON public.api_keys USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_usage' AND policyname='allow_all_api_usage') THEN
    CREATE POLICY "allow_all_api_usage" ON public.api_usage USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Cleanup function for expired emails
CREATE OR REPLACE FUNCTION public.cleanup_expired_emails()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.received_emails WHERE temp_email_id IN (
    SELECT id FROM public.temp_emails WHERE expires_at < now()
  );
  DELETE FROM public.temp_emails WHERE expires_at < now();
END;
$$;
