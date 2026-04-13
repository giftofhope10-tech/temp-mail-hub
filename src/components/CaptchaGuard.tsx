import { useState, useEffect, useRef, useCallback } from "react";
import { Shield, Loader2 } from "lucide-react";

interface CaptchaGuardProps {
  onVerified: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

// Cloudflare Turnstile test key (always passes) — replace with your real site key
// after adding your domains in Cloudflare Turnstile dashboard
const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

const CaptchaGuard = ({ onVerified }: CaptchaGuardProps) => {
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const handleSuccess = useCallback(() => {
    onVerified();
  }, [onVerified]);

  useEffect(() => {
    const renderWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        setLoading(false);
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: handleSuccess,
          theme: "dark",
          appearance: "always",
        });
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      window.onTurnstileLoad = renderWidget;
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [handleSuccess]);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="gradient-card rounded-2xl border border-border/50 p-8 max-w-md w-full text-center glow-blue animate-fade-in">
        <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-4">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Human Verification</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Please complete the verification to access TempMail
        </p>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading verification...</span>
          </div>
        )}

        <div ref={containerRef} className="flex justify-center" />
      </div>
    </div>
  );
};

export default CaptchaGuard;
