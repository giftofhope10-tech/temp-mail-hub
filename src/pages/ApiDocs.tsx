import { useState } from "react";
import { Copy, Check, Key, Zap, Shield, Globe, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const BASE_URL = "https://nkgpfgzsrtarracdkape.supabase.co/functions/v1/tempmail-api";

const ApiDocs = () => {
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const generateApiKey = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    setGenerating(true);
    try {
      const key = "tm_" + crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase.from("api_keys").insert({
        api_key: key,
        email,
        plan: "free",
        allowed_domains: ["kameti.online"],
        rate_limit_per_minute: 10,
      });
      if (error) throw error;
      setApiKey(key);
      toast.success("API key generated!");
    } catch {
      toast.error("Failed to generate key. Email may already have a key.");
    } finally {
      setGenerating(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success("Copied!");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const CodeBlock = ({ children, lang = "bash" }: { children: string; lang?: string }) => {
    const [copied, setCopied] = useState(false);
    return (
      <div className="relative group">
        <pre className="bg-muted/50 border border-border/50 rounded-lg p-4 text-xs font-mono overflow-x-auto text-foreground">
          <code>{children}</code>
        </pre>
        <button
          className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 glow-blue">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gradient">TempMail API</h1>
              <p className="text-[10px] text-muted-foreground">Developer Documentation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold text-gradient">TempMail Developer API</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Integrate disposable email into your apps. Generate temp emails, receive messages, and manage inboxes programmatically.
          </p>
          <p className="text-xs text-muted-foreground">
            Contact: <a href="mailto:contact@mytempmail.pro" className="text-primary hover:underline">contact@mytempmail.pro</a>
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="gradient-card rounded-xl border border-border/50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Free Plan</h3>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>✓ 1 domain (kameti.online)</li>
              <li>✓ 10 requests/minute</li>
              <li>✓ Generate & receive emails</li>
              <li>✓ 24h email lifetime</li>
              <li className="text-xs text-accent">Backlink required: "Powered by TempMail"</li>
            </ul>
          </div>
          <div className="gradient-card rounded-xl border border-primary/30 p-5 space-y-3 glow-blue">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Paid Plan</h3>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Pro</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>✓ All 3+ domains</li>
              <li>✓ Unlimited requests</li>
              <li>✓ Priority support</li>
              <li>✓ No backlink required</li>
              <li className="text-xs text-primary">Contact for pricing</li>
            </ul>
          </div>
        </div>

        {/* API Key Generator */}
        <div className="gradient-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Get Your API Key</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm"
            />
            <Button onClick={generateApiKey} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Generate
            </Button>
          </div>
          {apiKey && (
            <div className="flex items-center gap-2 bg-background/50 border border-primary/30 rounded-lg p-3">
              <code className="flex-1 text-xs font-mono text-primary truncate">{apiKey}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyKey}>
                {copiedKey ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Authentication */}
        <section className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Authentication
          </h3>
          <p className="text-sm text-muted-foreground">Include your API key in the <code className="text-primary">x-api-key</code> header:</p>
          <CodeBlock>{`curl -H "x-api-key: YOUR_API_KEY" \\
  ${BASE_URL}/domains`}</CodeBlock>
        </section>

        {/* Endpoints */}
        <section className="space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Endpoints
          </h3>

          {/* GET /domains */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-green-500/10 text-green-400 px-2 py-0.5 rounded">GET</span>
              <code className="text-sm font-mono">/domains</code>
            </div>
            <p className="text-sm text-muted-foreground">List available domains for your plan.</p>
            <CodeBlock>{`curl -H "x-api-key: YOUR_API_KEY" \\
  ${BASE_URL}/domains

# Response
{
  "domains": ["kameti.online"],
  "plan": "free"
}`}</CodeBlock>
          </div>

          {/* POST /generate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">POST</span>
              <code className="text-sm font-mono">/generate</code>
            </div>
            <p className="text-sm text-muted-foreground">Generate a new temporary email address.</p>
            <CodeBlock>{`curl -X POST \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "kameti.online"}' \\
  ${BASE_URL}/generate

# Response
{
  "email": {
    "id": "uuid-here",
    "email_address": "coolwolf42@kameti.online",
    "created_at": "2026-04-13T...",
    "expires_at": "2026-04-14T..."
  }
}`}</CodeBlock>
          </div>

          {/* GET /inbox */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-green-500/10 text-green-400 px-2 py-0.5 rounded">GET</span>
              <code className="text-sm font-mono">/inbox?email_id=UUID</code>
            </div>
            <p className="text-sm text-muted-foreground">Fetch received emails for a temp email.</p>
            <CodeBlock>{`curl -H "x-api-key: YOUR_API_KEY" \\
  "${BASE_URL}/inbox?email_id=UUID_HERE"

# Response
{
  "emails": [
    {
      "id": "...",
      "from_address": "sender@example.com",
      "subject": "Hello",
      "body_text": "...",
      "body_html": "...",
      "received_at": "...",
      "is_read": false
    }
  ]
}`}</CodeBlock>
          </div>

          {/* DELETE /email */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-0.5 rounded">DELETE</span>
              <code className="text-sm font-mono">/email?id=UUID</code>
            </div>
            <p className="text-sm text-muted-foreground">Delete a specific received email.</p>
            <CodeBlock>{`curl -X DELETE \\
  -H "x-api-key: YOUR_API_KEY" \\
  "${BASE_URL}/email?id=EMAIL_UUID"

# Response
{ "success": true }`}</CodeBlock>
          </div>
        </section>

        {/* Code Examples */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Code Examples</h3>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">JavaScript / Node.js</h4>
            <CodeBlock lang="javascript">{`const API_KEY = "tm_your_key_here";
const BASE = "${BASE_URL}";

// Generate a temp email
const res = await fetch(BASE + "/generate", {
  method: "POST",
  headers: {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ domain: "kameti.online" })
});
const { email } = await res.json();
console.log("Temp email:", email.email_address);

// Poll for incoming emails
const inbox = await fetch(
  BASE + "/inbox?email_id=" + email.id,
  { headers: { "x-api-key": API_KEY } }
).then(r => r.json());
console.log("Received:", inbox.emails.length, "emails");`}</CodeBlock>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Python</h4>
            <CodeBlock lang="python">{`import requests

API_KEY = "tm_your_key_here"
BASE = "${BASE_URL}"
headers = {"x-api-key": API_KEY}

# Generate temp email
res = requests.post(f"{BASE}/generate",
    headers={**headers, "Content-Type": "application/json"},
    json={"domain": "kameti.online"})
email = res.json()["email"]
print(f"Temp email: {email['email_address']}")

# Check inbox
inbox = requests.get(f"{BASE}/inbox?email_id={email['id']}",
    headers=headers).json()
print(f"Received: {len(inbox['emails'])} emails")`}</CodeBlock>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="gradient-card rounded-xl border border-border/50 p-5 space-y-3">
          <h3 className="font-semibold">Rate Limits & Fair Use</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Free Plan</p>
              <p className="font-mono text-primary">10 req/min</p>
            </div>
            <div>
              <p className="text-muted-foreground">Paid Plan</p>
              <p className="font-mono text-primary">Unlimited</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Free plan requires a backlink: <code className="text-primary">&lt;a href="https://mytempmail.pro"&gt;Powered by TempMail&lt;/a&gt;</code>
          </p>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            Need help? <a href="mailto:contact@mytempmail.pro" className="text-primary hover:underline">contact@mytempmail.pro</a>
          </p>
          <p className="text-xs text-muted-foreground">
            © 2026 TempMail — All rights reserved
          </p>
        </footer>
      </main>
    </div>
  );
};

export default ApiDocs;
