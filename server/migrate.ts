import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function runMigrations() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if tables exist by attempting a query
  const { error: checkError } = await supabase
    .from("temp_emails")
    .select("id")
    .limit(1);

  if (!checkError) {
    console.log("Database tables already exist, skipping migration.");
    return;
  }

  // Tables don't exist — user must create them via Supabase SQL Editor
  console.warn("\n⚠️  Database tables not found in Supabase.");
  console.warn("Please run the following SQL in your Supabase SQL Editor:");
  console.warn("https://supabase.com/dashboard/project/lwsrdqpxnlrzjqucbdwt/sql/new\n");
  console.warn(`
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

CREATE POLICY "service_role_all_temp_emails" ON public.temp_emails USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_received_emails" ON public.received_emails USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_api_keys" ON public.api_keys USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_api_usage" ON public.api_usage USING (true) WITH CHECK (true);
  `);
}
