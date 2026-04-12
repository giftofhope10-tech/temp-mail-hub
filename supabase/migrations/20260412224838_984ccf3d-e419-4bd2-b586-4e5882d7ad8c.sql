CREATE TABLE public.temp_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE TABLE public.received_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temp_email_id UUID NOT NULL REFERENCES public.temp_emails(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  subject TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  body_html TEXT DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.temp_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create temp emails" ON public.temp_emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read temp emails" ON public.temp_emails FOR SELECT USING (true);
CREATE POLICY "Anyone can delete temp emails" ON public.temp_emails FOR DELETE USING (true);

CREATE POLICY "Anyone can read received emails" ON public.received_emails FOR SELECT USING (true);
CREATE POLICY "Anyone can insert received emails" ON public.received_emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete received emails" ON public.received_emails FOR DELETE USING (true);

CREATE INDEX idx_received_emails_temp_id ON public.received_emails(temp_email_id);
CREATE INDEX idx_temp_emails_address ON public.temp_emails(email_address);
CREATE INDEX idx_temp_emails_expires ON public.temp_emails(expires_at);