import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = "v1.0";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a Shakespeare translator. Given a line of Shakespearean text, provide a clear, simple modern English translation that a child could understand.

Rules:
- Output ONLY the modern English translation, nothing else
- Keep it concise - one or two sentences maximum
- Use simple, everyday vocabulary
- Preserve the emotional tone and meaning
- Do not add explanations or context`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Get authorization header to check user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create user client to verify auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lineblock_id, style = 'plain_english', force = false } = await req.json();

    if (!lineblock_id) {
      return new Response(JSON.stringify({ error: 'lineblock_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if translation already exists
    if (!force) {
      const { data: existing } = await supabase
        .from('lineblock_translations')
        .select('*')
        .eq('lineblock_id', lineblock_id)
        .eq('style', style)
        .eq('status', 'completed')
        .single();

      if (existing) {
        return new Response(JSON.stringify({ 
          success: true, 
          translation: existing,
          cached: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get the line block text
    const { data: lineBlock, error: lineBlockError } = await supabase
      .from('line_blocks')
      .select('text_raw, speaker_name')
      .eq('id', lineblock_id)
      .single();

    if (lineBlockError || !lineBlock) {
      return new Response(JSON.stringify({ error: 'Line block not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert translation record as processing
    const { error: upsertError } = await supabase
      .from('lineblock_translations')
      .upsert({
        lineblock_id,
        style,
        status: 'processing',
        model: MODEL,
        prompt_version: PROMPT_VERSION,
      }, {
        onConflict: 'lineblock_id,style',
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Translate this Shakespearean line to modern English:\n\n"${lineBlock.text_raw}"` },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      
      await supabase
        .from('lineblock_translations')
        .update({ 
          status: 'error', 
          error: `OpenAI API error: ${openaiResponse.status}` 
        })
        .eq('lineblock_id', lineblock_id)
        .eq('style', style);

      return new Response(JSON.stringify({ error: 'Translation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiData = await openaiResponse.json();
    const translationText = openaiData.choices?.[0]?.message?.content?.trim();

    if (!translationText) {
      await supabase
        .from('lineblock_translations')
        .update({ status: 'error', error: 'Empty response from OpenAI' })
        .eq('lineblock_id', lineblock_id)
        .eq('style', style);

      return new Response(JSON.stringify({ error: 'Empty translation result' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update with completed translation
    const { data: translation, error: updateError } = await supabase
      .from('lineblock_translations')
      .update({
        translation_text: translationText,
        status: 'completed',
        error: null,
      })
      .eq('lineblock_id', lineblock_id)
      .eq('style', style)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save translation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      translation,
      cached: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
