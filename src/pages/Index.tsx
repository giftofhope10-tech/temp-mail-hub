import { useState, useCallback, useEffect, useRef } from "react";
import Header from "@/components/Header";
import EmailGenerator from "@/components/EmailGenerator";
import EmailInbox, { type Email } from "@/components/EmailInbox";
import CaptchaGuard from "@/components/CaptchaGuard";
import StatsBar from "@/components/StatsBar";
import { generateEmail } from "@/lib/emailUtils";
import { parseStoredEmailContent } from "@/lib/emailContent";
import { toast } from "sonner";

const STORAGE_KEY = "tempmail_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000;

interface StoredSession {
  email: string;
  domain: string;
  sessionId: string;
  createdAt: number;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    const elapsed = Date.now() - session.createdAt;
    if (elapsed >= SESSION_DURATION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveSession(session: StoredSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

const Index = () => {
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number>(Date.now());
  const initialized = useRef(false);

  useEffect(() => {
    if (!verified || initialized.current) return;
    initialized.current = true;

    const existing = loadSession();
    if (existing) {
      setEmail(existing.email);
      setDomain(existing.domain);
      setSessionId(existing.sessionId);
      setCreatedAt(existing.createdAt);
    } else {
      const newEmail = generateEmail();
      setEmail(newEmail.email);
      setDomain(newEmail.domain);
      registerEmail(newEmail.email, newEmail.domain);
    }
  }, [verified]);

  useEffect(() => {
    if (!sessionId) return;
    fetchEmails();
    const interval = setInterval(() => fetchEmails(), 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    const remaining = SESSION_DURATION - (Date.now() - createdAt);
    if (remaining <= 0) return;
    const timer = setTimeout(() => {
      handleDeleteEmail();
      toast.info("Email expired after 24 hours, new one generated!");
    }, remaining);
    return () => clearTimeout(timer);
  }, [createdAt]);

  const registerEmail = async (emailAddr: string, emailDomain: string) => {
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_address: emailAddr }),
      });
      if (!res.ok) throw new Error("Failed to register");
      const data = await res.json();
      const now = Date.now();
      setSessionId(data.id);
      setCreatedAt(now);
      saveSession({ email: emailAddr, domain: emailDomain, sessionId: data.id, createdAt: now });
    } catch {
      const fallbackId = "local-" + Date.now();
      const now = Date.now();
      setSessionId(fallbackId);
      setCreatedAt(now);
      saveSession({ email: emailAddr, domain: emailDomain, sessionId: fallbackId, createdAt: now });
    }
  };

  const fetchEmails = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/emails/${sessionId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEmails(
        data.map((e: any) => {
          const parsedContent = parseStoredEmailContent(e.body_text, e.body_html);
          return {
            id: e.id,
            from: e.from_address,
            subject: e.subject || "",
            body: parsedContent.text || "",
            body_html: parsedContent.html || "",
            received_at: new Date(e.received_at),
            read: e.is_read || false,
          };
        })
      );
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleNewEmail = useCallback((newEmail: string, newDomain: string) => {
    setEmail(newEmail);
    setDomain(newDomain);
    setEmails([]);
    setSessionId(null);
    registerEmail(newEmail, newDomain);
  }, []);

  const handleDeleteEmail = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    initialized.current = false;
    const newEmail = generateEmail();
    setEmail(newEmail.email);
    setDomain(newEmail.domain);
    setEmails([]);
    setSessionId(null);
    registerEmail(newEmail.email, newEmail.domain);
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
        <StatsBar createdAt={createdAt} />
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
