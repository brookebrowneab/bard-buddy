import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = "v1.0";
const MODEL = "gpt-4o-mini";
const DEFAULT_STYLE = "kid_modern_english_v1";
// Process max 10 lines per request to avoid timeout (edge functions have 60s limit)
const MAX_LINES_PER_REQUEST = 10;

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

    const { scene_id, section_id, style = DEFAULT_STYLE } = await req.json();

    if (!scene_id) {
      return new Response(JSON.stringify({ error: 'scene_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all line blocks for this scene/section
    let query = supabase
      .from('line_blocks')
      .select('id, text_raw, speaker_name')
      .eq('scene_id', scene_id)
      .order('order_index');

    if (section_id) {
      query = query.eq('section_id', section_id);
    }

    const { data: lineBlocks, error: lineBlocksError } = await query;

    if (lineBlocksError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch line blocks' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!lineBlocks || lineBlocks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No line blocks found',
        total: 0,
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing completed translations
    const lineBlockIds = lineBlocks.map(lb => lb.id);
    const { data: existingTranslations } = await supabase
      .from('lineblock_translations')
      .select('lineblock_id')
      .in('lineblock_id', lineBlockIds)
      .eq('style', style)
      .eq('status', 'complete');

    const existingIds = new Set((existingTranslations || []).map(t => t.lineblock_id));
    const missingBlocks = lineBlocks.filter(lb => !existingIds.has(lb.id));

    // Only process up to MAX_LINES_PER_REQUEST to avoid timeout
    const blocksToProcess = missingBlocks.slice(0, MAX_LINES_PER_REQUEST);
    const hasMore = missingBlocks.length > MAX_LINES_PER_REQUEST;

    if (blocksToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All translations already complete',
        total: lineBlocks.length,
        processed: 0,
        already_complete: lineBlocks.length,
        has_more: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process all lines in this batch in parallel
    let processed = 0;
    let errors = 0;

    const batchPromises = blocksToProcess.map(async (block) => {
      try {
        // Mark as pending
        await supabase
          .from('lineblock_translations')
          .upsert({
            lineblock_id: block.id,
            style,
            status: 'pending',
            source: 'ai',
            review_status: 'needs_review',
            model: MODEL,
            prompt_version: PROMPT_VERSION,
          }, {
            onConflict: 'lineblock_id,style',
          });

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
              { role: 'user', content: `Translate this Shakespearean line to modern English:\n\n"${block.text_raw}"` },
            ],
            max_tokens: 200,
            temperature: 0.3,
          }),
        });

        if (!openaiResponse.ok) {
          throw new Error(`OpenAI API error: ${openaiResponse.status}`);
        }

        const openaiData = await openaiResponse.json();
        const translationText = openaiData.choices?.[0]?.message?.content?.trim();

        if (!translationText) {
          throw new Error('Empty response from OpenAI');
        }

        // Save translation
        await supabase
          .from('lineblock_translations')
          .update({
            translation_text: translationText,
            status: 'complete',
            error: null,
          })
          .eq('lineblock_id', block.id)
          .eq('style', style);

        return { success: true };
      } catch (error) {
        console.error(`Error translating ${block.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await supabase
          .from('lineblock_translations')
          .update({
            status: 'failed',
            error: errorMessage,
          })
          .eq('lineblock_id', block.id)
          .eq('style', style);

        return { success: false, error: errorMessage };
      }
    });

    const results = await Promise.all(batchPromises);
    processed = results.filter(r => r.success).length;
    errors = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ 
      success: true,
      total: lineBlocks.length,
      already_complete: existingIds.size,
      processed,
      errors,
      has_more: hasMore,
      remaining: missingBlocks.length - processed,
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
