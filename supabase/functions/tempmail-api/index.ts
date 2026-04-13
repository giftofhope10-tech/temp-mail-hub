import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return json({ error: "Missing x-api-key header" }, 401);
  }

  // Validate API key
  const { data: keyData, error: keyError } = await supabase
    .from("api_keys")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (keyError || !keyData) {
    return json({ error: "Invalid or inactive API key" }, 403);
  }

  // Rate limiting
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { count } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", keyData.id)
    .gte("requested_at", oneMinuteAgo);

  if ((count || 0) >= keyData.rate_limit_per_minute) {
    return json({ error: "Rate limit exceeded", limit: keyData.rate_limit_per_minute, reset_in: "60s" }, 429);
  }

  // Log usage
  await supabase.from("api_usage").insert({ api_key_id: keyData.id, endpoint: new URL(req.url).pathname });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/tempmail-api\/?/, "");

  try {
    // GET /domains — list available domains
    if (req.method === "GET" && (path === "domains" || path === "")) {
      const allDomains = ["kameti.online", "giftofhop.online", "globaljobpoint.com"];
      const available = keyData.plan === "paid" ? allDomains : (keyData.allowed_domains || [allDomains[0]]);
      return json({ domains: available, plan: keyData.plan });
    }

    // POST /generate — generate temp email
    if (req.method === "POST" && path === "generate") {
      const body = await req.json().catch(() => ({}));
      const domain = body.domain || (keyData.allowed_domains?.[0]) || "kameti.online";

      // Check domain access
      const allDomains = ["kameti.online", "giftofhop.online", "globaljobpoint.com"];
      const allowed = keyData.plan === "paid" ? allDomains : (keyData.allowed_domains || [allDomains[0]]);
      if (!allowed.includes(domain)) {
        return json({ error: `Domain '${domain}' not available on your plan. Upgrade to paid for all domains.` }, 403);
      }

      const username = generateUsername();
      const emailAddr = `${username}@${domain}`;

      const { data, error } = await supabase
        .from("temp_emails")
        .insert({ email_address: emailAddr })
        .select("id, email_address, created_at, expires_at")
        .single();

      if (error) return json({ error: "Failed to create email" }, 500);
      return json({ email: data });
    }

    // GET /inbox?email_id=xxx — get emails
    if (req.method === "GET" && path === "inbox") {
      const emailId = url.searchParams.get("email_id");
      if (!emailId) return json({ error: "email_id parameter required" }, 400);

      const { data, error } = await supabase
        .from("received_emails")
        .select("id, from_address, subject, body_text, body_html, received_at, is_read")
        .eq("temp_email_id", emailId)
        .order("received_at", { ascending: false })
        .limit(50);

      if (error) return json({ error: "Failed to fetch emails" }, 500);
      return json({ emails: data || [] });
    }

    // DELETE /email?id=xxx — delete a specific email
    if (req.method === "DELETE" && path === "email") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id parameter required" }, 400);

      const { error } = await supabase.from("received_emails").delete().eq("id", id);
      if (error) return json({ error: "Failed to delete" }, 500);
      return json({ success: true });
    }

    return json({ error: "Not found", available_endpoints: ["GET /domains", "POST /generate", "GET /inbox?email_id=", "DELETE /email?id="] }, 404);
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateUsername() {
  const adj = ["cool","fast","wild","dark","blue","red","zen","hot","ice","pro","ace","max","top","neo","sky"];
  const nouns = ["mail","fox","wolf","bear","hawk","star","bolt","wave","fire","byte","node","flux","core","dash","link"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${a}${n}${num}`;
}
