import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the JWT token and verify it
    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { lineblock_id, style = "kid_modern_english_v1", translation_text, review_status } = await req.json();

    if (!lineblock_id || !translation_text) {
      return new Response(
        JSON.stringify({ error: "lineblock_id and translation_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if translation exists
    const { data: existingTranslation } = await supabaseAdmin
      .from("lineblock_translations")
      .select("id, source, status")
      .eq("lineblock_id", lineblock_id)
      .eq("style", style)
      .maybeSingle();

    let newSource: string;
    if (!existingTranslation || existingTranslation.status === "missing") {
      // Creating new translation or was missing
      newSource = "manual";
    } else if (existingTranslation.source === "ai") {
      // Editing AI translation
      newSource = "ai_edited";
    } else {
      // Keep existing source (manual or ai_edited)
      newSource = existingTranslation.source;
    }

    const translationData = {
      lineblock_id,
      style,
      translation_text,
      status: "complete",
      source: newSource,
      review_status: review_status || "needs_review",
      edited_at: new Date().toISOString(),
      edited_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingTranslation) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from("lineblock_translations")
        .update(translationData)
        .eq("id", existingTranslation.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabaseAdmin
        .from("lineblock_translations")
        .insert({
          ...translationData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return new Response(
      JSON.stringify({ success: true, translation: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error saving translation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to save translation" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
