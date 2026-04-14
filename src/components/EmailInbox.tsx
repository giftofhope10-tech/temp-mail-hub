import { useState, useRef, useEffect } from "react";
import { RefreshCw, Inbox, Mail, Clock, ChevronRight, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/emailUtils";

export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  body_html?: string;
  received_at: Date;
  read: boolean;
}

interface EmailInboxProps {
  emails: Email[];
  loading: boolean;
  onRefresh: () => void;
  onDeleteEmail: (id: string) => void;
}

const EmailHtmlViewer = ({ html }: { html: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  const srcdocContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1f1f1f;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    a { color: #1a73e8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { max-width: 100%; height: auto; display: block; }
    table { max-width: 100% !important; border-collapse: collapse; }
    td, th { word-break: break-word; }
    * { max-width: 100% !important; box-sizing: border-box; }
    blockquote { border-left: 3px solid #dadce0; margin: 8px 0; padding: 0 12px; color: #5f6368; }
    pre { background: #f8f9fa; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
    h1, h2, h3, h4, h5, h6 { color: #202124; }
    hr { border: none; border-top: 1px solid #dadce0; margin: 16px 0; }
    p { margin: 0 0 12px 0; }
  </style>
  <script>
    function sendHeight() {
      var h = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: 'email-iframe-height', height: h }, '*');
    }
    window.addEventListener('load', function() { setTimeout(sendHeight, 50); setTimeout(sendHeight, 300); });
    new MutationObserver(sendHeight).observe(document.body, { childList: true, subtree: true });
  </script>
</head>
<body>${html.replace(/`/g, '\\`').replace(/<script[\s\S]*?<\/script>/gi, '')}</body>
</html>`;

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'email-iframe-height' && typeof e.data.height === 'number') {
        setHeight(Math.max(200, Math.min(e.data.height + 32, 1200)));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdocContent}
      sandbox="allow-same-origin allow-scripts"
      style={{
        width: "100%",
        height: `${height}px`,
        border: "none",
        borderRadius: "8px",
        background: "#ffffff",
      }}
      title="Email content"
    />
  );
};

const EmailInbox = ({ emails, loading, onRefresh, onDeleteEmail }: EmailInboxProps) => {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  if (selectedEmail) {
    return (
      <div className="gradient-card rounded-xl border border-border/50 animate-fade-in">
        <div className="p-4 border-b border-border/50 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
            onClick={() => setSelectedEmail(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{selectedEmail.subject || "(No Subject)"}</h3>
            <p className="text-xs text-muted-foreground truncate">From: {selectedEmail.from}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onDeleteEmail(selectedEmail.id);
              setSelectedEmail(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(selectedEmail.received_at)}
          </div>
          <div className="text-sm text-secondary-foreground leading-relaxed">
            {selectedEmail.body_html ? (
              <EmailHtmlViewer html={selectedEmail.body_html} />
            ) : (
              <div className="whitespace-pre-wrap">
                {selectedEmail.body || "No content"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-card rounded-xl border border-border/50">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Inbox</h2>
          {emails.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {emails.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 hover:bg-primary/10 hover:text-primary"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Email list */}
      {emails.length === 0 ? (
        <div className="py-16 text-center">
          <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-3">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No emails yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Emails will appear here automatically
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {emails.map((email) => (
            <button
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className={`w-full text-left p-4 hover:bg-secondary/50 transition-colors flex items-center gap-3 group ${
                !email.read ? "bg-primary/5" : ""
              }`}
            >
              <div className={`h-2 w-2 rounded-full shrink-0 ${!email.read ? "bg-primary" : "bg-transparent"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-medium truncate">{email.from}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTimeAgo(email.received_at)}
                  </span>
                </div>
                <p className={`text-sm truncate ${!email.read ? "font-semibold" : ""}`}>
                  {email.subject || "(No Subject)"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {email.body?.slice(0, 80) || "No preview"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailInbox;
