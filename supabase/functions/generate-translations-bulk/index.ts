import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = "v1.0";
const MODEL = "gpt-4o-mini";
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 1000;

const SYSTEM_PROMPT = `You are a Shakespeare translator. Given a line of Shakespearean text, provide a clear, simple modern English translation that a child could understand.

Rules:
- Output ONLY the modern English translation, nothing else
- Keep it concise - one or two sentences maximum
- Use simple, everyday vocabulary
- Preserve the emotional tone and meaning
- Do not add explanations or context`;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

    const { scene_id, section_id, style = 'plain_english' } = await req.json();

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
      .eq('status', 'completed');

    const existingIds = new Set((existingTranslations || []).map(t => t.lineblock_id));
    const missingBlocks = lineBlocks.filter(lb => !existingIds.has(lb.id));

    if (missingBlocks.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All translations already complete',
        total: lineBlocks.length,
        processed: 0,
        already_complete: lineBlocks.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create or update job record
    const { data: job, error: jobError } = await supabase
      .from('translation_jobs')
      .upsert({
        scene_id,
        section_id: section_id || null,
        style,
        status: 'processing',
        total_lines: lineBlocks.length,
        completed_lines: existingIds.size,
        error: null,
      }, {
        onConflict: 'id',
      })
      .select()
      .single();

    // Process in batches
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < missingBlocks.length; i += BATCH_SIZE) {
      const batch = missingBlocks.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (block) => {
        try {
          // Mark as processing
          await supabase
            .from('lineblock_translations')
            .upsert({
              lineblock_id: block.id,
              style,
              status: 'processing',
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
              status: 'completed',
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
              status: 'error',
              error: errorMessage,
            })
            .eq('lineblock_id', block.id)
            .eq('style', style);

          return { success: false, error: errorMessage };
        }
      });

      const results = await Promise.all(batchPromises);
      const batchSuccesses = results.filter(r => r.success).length;
      processed += batchSuccesses;
      errors += results.filter(r => !r.success).length;

      // Update job progress
      if (job) {
        await supabase
          .from('translation_jobs')
          .update({
            completed_lines: existingIds.size + processed,
          })
          .eq('id', job.id);
      }

      // Rate limiting delay between batches
      if (i + BATCH_SIZE < missingBlocks.length) {
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    // Update job as complete
    if (job) {
      await supabase
        .from('translation_jobs')
        .update({
          status: errors > 0 ? 'error' : 'completed',
          completed_lines: existingIds.size + processed,
          error: errors > 0 ? `${errors} translations failed` : null,
        })
        .eq('id', job.id);
    }

    return new Response(JSON.stringify({ 
      success: true,
      total: lineBlocks.length,
      already_complete: existingIds.size,
      processed,
      errors,
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
