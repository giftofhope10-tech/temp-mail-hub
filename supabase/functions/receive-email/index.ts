import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const WEBHOOK_SECRET = Deno.env.get("EMAIL_WEBHOOK_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verify webhook secret
    const authHeader = req.headers.get("x-webhook-secret");
    if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to, from, subject, text, html } = body;

    if (!to || !from) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, from" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the temp email matching the "to" address
    const recipientEmail = Array.isArray(to) ? to[0] : to;

    const { data: tempEmail, error: lookupError } = await supabase
      .from("temp_emails")
      .select("id, expires_at")
      .eq("email_address", recipientEmail.toLowerCase())
      .single();

    if (lookupError || !tempEmail) {
      console.log(`No temp email found for: ${recipientEmail}`);
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if expired
    if (new Date(tempEmail.expires_at) < new Date()) {
      console.log(`Temp email expired: ${recipientEmail}`);
      return new Response(JSON.stringify({ error: "Email address expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store the received email
    const { error: insertError } = await supabase
      .from("received_emails")
      .insert({
        temp_email_id: tempEmail.id,
        from_address: typeof from === "string" ? from : from.address || from[0],
        subject: subject || "(No Subject)",
        body_text: text || "",
        body_html: html || "",
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to store email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Email stored for ${recipientEmail} from ${from}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing email:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
