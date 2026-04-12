import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import EmailGenerator from "@/components/EmailGenerator";
import EmailInbox, { type Email } from "@/components/EmailInbox";
import CaptchaGuard from "@/components/CaptchaGuard";
import StatsBar from "@/components/StatsBar";
import { generateEmail } from "@/lib/emailUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize email on verification
  useEffect(() => {
    if (verified && !email) {
      const newEmail = generateEmail();
      setEmail(newEmail.email);
      setDomain(newEmail.domain);
      registerEmail(newEmail.email);
    }
  }, [verified, email]);

  // Poll for new emails every 5 seconds
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => fetchEmails(), 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const registerEmail = async (emailAddr: string) => {
    try {
      const { data, error } = await supabase
        .from("temp_emails")
        .insert({ email_address: emailAddr })
        .select("id")
        .single();

      if (error) throw error;
      setSessionId(data.id);
    } catch {
      // If table doesn't exist yet, just use local state
      setSessionId("local-" + Date.now());
    }
  };

  const fetchEmails = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("received_emails")
        .select("*")
        .eq("temp_email_id", sessionId)
        .order("received_at", { ascending: false });

      if (error) throw error;
      if (data) {
        setEmails(
          data.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            from: e.from_address as string,
            subject: (e.subject as string) || "",
            body: (e.body_text as string) || "",
            received_at: new Date(e.received_at as string),
            read: (e.is_read as boolean) || false,
          }))
        );
      }
    } catch {
      // Silently handle - table might not exist yet
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleNewEmail = useCallback((newEmail: string, newDomain: string) => {
    setEmail(newEmail);
    setDomain(newDomain);
    setEmails([]);
    setSessionId(null);
    registerEmail(newEmail);
  }, []);

  const handleDeleteEmail = useCallback(() => {
    const newEmail = generateEmail();
    setEmail(newEmail.email);
    setDomain(newEmail.domain);
    setEmails([]);
    setSessionId(null);
    registerEmail(newEmail.email);
    toast.success("Email deleted, new one generated!");
  }, []);

  const handleDeleteSingleEmail = useCallback((id: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== id));
  }, []);

  if (!verified) {
    return <CaptchaGuard onVerified={() => setVerified(true)} />;
  }

  return (
    <div className="min-h-screen gradient-hero">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-xl space-y-4">
        <EmailGenerator
          email={email}
          domain={domain}
          onNewEmail={handleNewEmail}
          onDeleteEmail={handleDeleteEmail}
        />
        <StatsBar />
        <EmailInbox
          emails={emails}
          loading={loading}
          onRefresh={fetchEmails}
          onDeleteEmail={handleDeleteSingleEmail}
        />
      </main>
      <footer className="text-center py-6 text-xs text-muted-foreground">
        TempMail — Disposable email for your privacy
      </footer>
    </div>
  );
};

export default Index;
