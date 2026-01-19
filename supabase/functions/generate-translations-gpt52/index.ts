import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = "gpt5_v1";
const MODEL = "openai/gpt-5";
const STYLE = "plain_english_gpt5";

// Some reasoning-capable models may spend tokens "thinking" before producing output.
// Give enough budget to reliably produce the final translation.
const MAX_COMPLETION_TOKENS = 800;

// Keep batches smaller to reduce timeouts when using high-capability models.
const MAX_LINES_PER_REQUEST = 5;

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    const { scene_id, section_id } = await req.json();

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

    // Get existing completed translations for this style
    const lineBlockIds = lineBlocks.map(lb => lb.id);
    const { data: existingTranslations } = await supabase
      .from('lineblock_translations')
      .select('lineblock_id')
      .in('lineblock_id', lineBlockIds)
      .eq('style', STYLE)
      .eq('status', 'complete');

    const existingIds = new Set((existingTranslations || []).map(t => t.lineblock_id));
    const missingBlocks = lineBlocks.filter(lb => !existingIds.has(lb.id));

    // Only process up to MAX_LINES_PER_REQUEST to avoid timeout
    const blocksToProcess = missingBlocks.slice(0, MAX_LINES_PER_REQUEST);
    const hasMore = missingBlocks.length > MAX_LINES_PER_REQUEST;

    if (blocksToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All translations already complete for this style',
        total: lineBlocks.length,
        processed: 0,
        already_complete: existingIds.size,
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
            style: STYLE,
            status: 'pending',
            source: 'ai',
            review_status: 'needs_review',
            model: MODEL,
            prompt_version: PROMPT_VERSION,
          }, {
            onConflict: 'lineblock_id,style',
          });

        // Call Lovable AI Gateway
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Translate this Shakespearean line to modern English:\n\n"${block.text_raw}"` },
            ],
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            // GPT-5 only supports temperature=1
            temperature: 1,
          }),
        });

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          console.error(`AI API error ${aiResponse.status}:`, errorBody);
          if (aiResponse.status === 429) {
            throw new Error('Rate limit exceeded - please try again later');
          }
          if (aiResponse.status === 402) {
            throw new Error('Payment required - please add credits to your workspace');
          }
          throw new Error(`AI API error: ${aiResponse.status} - ${errorBody.slice(0, 200)}`);
        }

        const aiData = await aiResponse.json();
        const choice = aiData?.choices?.[0];
        const msg = choice?.message;

        let translationText: string | undefined;
        const content = msg?.content;

        if (typeof content === 'string') {
          translationText = content.trim();
        } else if (Array.isArray(content)) {
          // Some providers return structured content parts
          translationText = content
            .map((part: any) => {
              if (typeof part === 'string') return part;
              return part?.text ?? part?.value ?? '';
            })
            .join('')
            .trim();
        }

        if (!translationText) {
          console.error('AI returned no message content:', JSON.stringify(aiData).slice(0, 1000));
          const refusal = msg?.refusal;
          const finishReason = choice?.finish_reason;
          throw new Error(
            refusal
              ? `Model refused: ${refusal}`
              : `Empty response from AI (finish_reason=${finishReason ?? 'unknown'})`
          );
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
          .eq('style', STYLE);

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
          .eq('style', STYLE);

        return { success: false, error: errorMessage };
      }
    });

    const results = await Promise.all(batchPromises);
    processed = results.filter(r => r.success).length;
    errors = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ 
      success: true,
      style: STYLE,
      model: MODEL,
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
