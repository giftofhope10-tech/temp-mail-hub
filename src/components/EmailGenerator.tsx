import { useState, useCallback } from "react";
import { Copy, RefreshCw, QrCode, Trash2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { generateEmail, getAvailableDomains } from "@/lib/emailUtils";

interface EmailGeneratorProps {
  email: string;
  domain: string;
  onNewEmail: (email: string, domain: string) => void;
  onDeleteEmail: () => void;
}

const EmailGenerator = ({ email, domain, onNewEmail, onDeleteEmail }: EmailGeneratorProps) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const domains = getAvailableDomains();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    toast.success("Email copied!");
    setTimeout(() => setCopied(false), 2000);
  }, [email]);

  const handleNewEmail = useCallback((selectedDomain?: string) => {
    const newEmail = generateEmail(selectedDomain || domain);
    onNewEmail(newEmail.email, newEmail.domain);
    setShowDomains(false);
    toast.success("New email generated!");
  }, [domain, onNewEmail]);

  const handleDomainChange = (d: string) => {
    const newEmail = generateEmail(d);
    onNewEmail(newEmail.email, d);
    setShowDomains(false);
  };

  return (
    <div className="gradient-card rounded-xl border border-border/50 p-4 md:p-6 glow-blue animate-fade-in">
      <p className="text-xs text-muted-foreground mb-2">Your temporary email</p>

      {/* Email display */}
      <div className="flex items-center gap-2 bg-background/50 rounded-lg border border-border/50 p-3 mb-4">
        <span className="flex-1 font-mono text-sm md:text-base text-foreground truncate select-all">
          {email}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Domain selector */}
      <div className="relative mb-4">
        <button
          onClick={() => setShowDomains(!showDomains)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Domain: <span className="text-primary font-medium">{domain}</span></span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showDomains ? "rotate-180" : ""}`} />
        </button>
        {showDomains && (
          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-10 min-w-[200px] animate-fade-in">
            {domains.map((d) => (
              <button
                key={d}
                onClick={() => handleDomainChange(d)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  d === domain ? "text-primary bg-primary/5" : "text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
          onClick={() => handleNewEmail()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Change
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
          onClick={() => setShowQR(!showQR)}
        >
          <QrCode className="h-3.5 w-3.5" />
          QR
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          onClick={onDeleteEmail}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="mt-4 flex justify-center animate-fade-in">
          <div className="bg-foreground p-3 rounded-lg">
            <QRCodeSVG value={email} size={140} />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailGenerator;
