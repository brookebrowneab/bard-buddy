import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT_VERSION = "gpt5_v2";
const MODEL = "openai/gpt-5";
const STYLE = "plain_english_gpt5";

// Threshold for "too long" blocks - skip OpenAI and flag for manual split
const MAX_CHAR_LENGTH = 1200;

// Default max output tokens (increased from 200 to 400)
const DEFAULT_MAX_OUTPUT_TOKENS = 400;

// Retry max output tokens if first attempt has finish_reason=length or empty
const RETRY_MAX_OUTPUT_TOKENS = 800;

// Keep batches smaller to reduce timeouts when using high-capability models.
const MAX_LINES_PER_REQUEST = 5;

// Tightened prompt to force brevity and no extra commentary
const SYSTEM_PROMPT = `You are a Shakespeare translator.

STRICT RULES:
- Output ONLY the modern English translation
- Max 2 sentences
- No commentary, no notes, no paraphrase labels
- No quotation marks around the translation
- Use simple, everyday vocabulary a child could understand
- Preserve the emotional tone and meaning`;

// Models that don't support temperature/top_p sampling params (only default=1)
const MODELS_NO_SAMPLING_PARAMS = ['openai/gpt-5', 'openai/gpt-5-mini', 'openai/gpt-5.2'];

// Check if model supports custom sampling parameters
function supportsTemperature(model: string): boolean {
  return !MODELS_NO_SAMPLING_PARAMS.some(m => model.toLowerCase().includes(m.toLowerCase()));
}

// Interface for per-block diagnostics
interface BlockDiagnostic {
  lineblock_id: string;
  text_char_len: number;
  prompt_char_len: number;
  max_output_tokens: number;
  model: string;
  success: boolean;
  skipped_too_long?: boolean;
  retried_without_sampling?: boolean;
  retried_with_more_tokens?: boolean;
  finish_reason?: string;
  extracted_text_length?: number;
  extracted_text_preview?: string; // first 120 chars for debugging
  error?: {
    http_status?: number;
    type?: string;
    code?: string;
    message: string;
  };
}

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
        processed: 0,
        block_diagnostics: [],
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
        has_more: false,
        block_diagnostics: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process all lines in this batch in parallel
    let processed = 0;
    let errors = 0;
    let skippedTooLong = 0;
    const blockDiagnostics: BlockDiagnostic[] = [];

    const batchPromises = blocksToProcess.map(async (block) => {
      const textCharLen = block.text_raw?.length || 0;
      const userPrompt = `Translate this Shakespearean line to modern English:\n\n"${block.text_raw}"`;
      const promptCharLen = SYSTEM_PROMPT.length + userPrompt.length;
      
      // Base diagnostic info - will update max_output_tokens if we retry
      let currentMaxTokens = DEFAULT_MAX_OUTPUT_TOKENS;
      const baseDiag = () => ({
        lineblock_id: block.id,
        text_char_len: textCharLen,
        prompt_char_len: promptCharLen,
        max_output_tokens: currentMaxTokens,
        model: MODEL,
      });

      // Check if block is too long - skip OpenAI and create issue
      if (textCharLen > MAX_CHAR_LENGTH) {
        const diag: BlockDiagnostic = {
          ...baseDiag(),
          success: false,
          skipped_too_long: true,
          error: {
            message: `Block too long (${textCharLen} chars > ${MAX_CHAR_LENGTH} threshold); split required`,
          },
        };

        console.log(`[SKIP] Block ${block.id}: too long (${textCharLen} chars)`, JSON.stringify(diag));

        try {
          // Check if issue already exists
          const { data: existingIssue } = await supabase
            .from('script_issues')
            .select('id')
            .eq('lineblock_id', block.id)
            .eq('issue_type', 'needs_split')
            .single();

          if (!existingIssue) {
            // Create script_issues record
            await supabase
              .from('script_issues')
              .insert({
                lineblock_id: block.id,
                issue_type: 'needs_split',
                note: `Block has ${textCharLen} characters (threshold: ${MAX_CHAR_LENGTH}). Needs manual split before translation.`,
                status: 'open',
                created_by: user.id,
              });
          }

          // Set translation as failed with specific error
          await supabase
            .from('lineblock_translations')
            .upsert({
              lineblock_id: block.id,
              style: STYLE,
              status: 'failed',
              error: `Block too long (${textCharLen} chars); split required`,
              source: 'ai',
              review_status: 'needs_review',
              model: MODEL,
              prompt_version: PROMPT_VERSION,
            }, {
              onConflict: 'lineblock_id,style',
            });

          return diag;
        } catch (err) {
          console.error(`Error handling oversized block ${block.id}:`, err);
          diag.error = { message: 'Failed to create issue for oversized block' };
          return diag;
        }
      }

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

        console.log(`[START] Block ${block.id}: text=${textCharLen}chars, prompt=${promptCharLen}chars, max_tokens=${currentMaxTokens}, model=${MODEL}`);

        // Build request payload - conditionally include temperature
        const buildPayload = (maxTokens: number, includeSamplingParams: boolean) => {
          const payload: any = {
            model: MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            max_completion_tokens: maxTokens,
          };
          
          // Only add temperature for models that support it
          if (includeSamplingParams && supportsTemperature(MODEL)) {
            payload.temperature = 0.2;
          }
          
          return payload;
        };

        // Helper to make the AI call
        const callAI = async (payload: any) => {
          return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        };

        // Helper to extract text from AI response
        const extractText = (aiData: any): { text: string | undefined; finishReason: string | undefined; refusal: string | undefined } => {
          const choice = aiData?.choices?.[0];
          const msg = choice?.message;
          const finishReason = choice?.finish_reason;
          const refusal = msg?.refusal;
          
          let text: string | undefined;
          const content = msg?.content;
          
          if (typeof content === 'string') {
            text = content.trim();
          } else if (Array.isArray(content)) {
            text = content
              .map((part: any) => {
                if (typeof part === 'string') return part;
                return part?.text ?? part?.value ?? '';
              })
              .join('')
              .trim();
          }
          
          return { text, finishReason, refusal };
        };

        let retriedWithoutSampling = false;
        let retriedWithMoreTokens = false;
        let finalFinishReason: string | undefined;
        let extractedTextLength = 0;
        let extractedTextPreview: string | undefined;

        // First attempt
        let aiResponse = await callAI(buildPayload(currentMaxTokens, true));

        // Check if we got an unsupported_value error for sampling params
        if (!aiResponse.ok && aiResponse.status === 400) {
          const errorBody = await aiResponse.text();
          const lowerError = errorBody.toLowerCase();
          
          if (lowerError.includes('unsupported') && 
              (lowerError.includes('temperature') || lowerError.includes('top_p') || lowerError.includes('sampling'))) {
            console.log(`[RETRY] Block ${block.id}: retrying without sampling params`);
            aiResponse = await callAI(buildPayload(currentMaxTokens, false));
            retriedWithoutSampling = true;
          } else {
            aiResponse = new Response(errorBody, { status: 400, headers: aiResponse.headers });
          }
        }

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          const httpStatus = aiResponse.status;
          
          let errorType: string | undefined;
          let errorCode: string | undefined;
          let errorMessage: string;

          try {
            const parsed = JSON.parse(errorBody);
            errorType = parsed.error?.type;
            errorCode = parsed.error?.code;
            errorMessage = parsed.error?.message || parsed.message || `API error ${httpStatus}`;
          } catch {
            errorMessage = `AI API error: ${httpStatus} - ${errorBody.slice(0, 300)}`;
          }

          const diag: BlockDiagnostic = {
            ...baseDiag(),
            success: false,
            retried_without_sampling: retriedWithoutSampling,
            error: { http_status: httpStatus, type: errorType, code: errorCode, message: errorMessage },
          };

          console.error(`[ERROR] Block ${block.id}:`, JSON.stringify(diag));

          await supabase
            .from('lineblock_translations')
            .update({ status: 'failed', error: JSON.stringify(diag.error) })
            .eq('lineblock_id', block.id)
            .eq('style', STYLE);

          return diag;
        }

        // Parse first attempt
        let aiData = await aiResponse.json();
        let { text: translationText, finishReason, refusal } = extractText(aiData);
        finalFinishReason = finishReason;
        extractedTextLength = translationText?.length || 0;
        extractedTextPreview = translationText?.slice(0, 120);

        // Retry with more tokens if finish_reason=length OR text is empty
        if ((finishReason === 'length' || !translationText) && !refusal) {
          console.log(`[RETRY] Block ${block.id}: finish_reason=${finishReason}, text_len=${extractedTextLength}, retrying with max_tokens=${RETRY_MAX_OUTPUT_TOKENS}`);
          
          currentMaxTokens = RETRY_MAX_OUTPUT_TOKENS;
          retriedWithMoreTokens = true;
          
          aiResponse = await callAI(buildPayload(RETRY_MAX_OUTPUT_TOKENS, !retriedWithoutSampling));
          
          if (aiResponse.ok) {
            aiData = await aiResponse.json();
            const retryResult = extractText(aiData);
            
            // Use retry result if it has more content
            if (retryResult.text && retryResult.text.length >= extractedTextLength) {
              translationText = retryResult.text;
              finalFinishReason = retryResult.finishReason;
              extractedTextLength = translationText.length;
              extractedTextPreview = translationText.slice(0, 120);
              refusal = retryResult.refusal;
            }
          }
        }

        // Check if we still have no text
        if (!translationText) {
          const emptyError = refusal
            ? `Model refused: ${refusal}`
            : `Empty response from AI (finish_reason=${finalFinishReason ?? 'unknown'}) with max_output_tokens=${currentMaxTokens}`;

          const diag: BlockDiagnostic = {
            ...baseDiag(),
            success: false,
            retried_without_sampling: retriedWithoutSampling,
            retried_with_more_tokens: retriedWithMoreTokens,
            finish_reason: finalFinishReason,
            extracted_text_length: extractedTextLength,
            error: {
              type: refusal ? 'refusal' : 'empty_response',
              code: finalFinishReason,
              message: emptyError,
            },
          };

          console.error(`[ERROR] Block ${block.id}: empty response`, JSON.stringify({ diag, aiData: JSON.stringify(aiData).slice(0, 500) }));

          await supabase
            .from('lineblock_translations')
            .update({ status: 'failed', error: JSON.stringify(diag.error) })
            .eq('lineblock_id', block.id)
            .eq('style', STYLE);

          return diag;
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

        const successDiag: BlockDiagnostic = { 
          ...baseDiag(), 
          success: true,
          retried_without_sampling: retriedWithoutSampling,
          retried_with_more_tokens: retriedWithMoreTokens,
          finish_reason: finalFinishReason,
          extracted_text_length: extractedTextLength,
          extracted_text_preview: extractedTextPreview,
        };
        
        const retryInfo = [
          retriedWithoutSampling ? 'no-sampling' : '',
          retriedWithMoreTokens ? `more-tokens(${RETRY_MAX_OUTPUT_TOKENS})` : '',
        ].filter(Boolean).join(', ');
        
        console.log(`[SUCCESS] Block ${block.id}: translated ${textCharLen} chars → ${extractedTextLength} chars${retryInfo ? ` (retried: ${retryInfo})` : ''}`);
        return successDiag;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        const diag: BlockDiagnostic = {
          ...baseDiag(),
          success: false,
          error: {
            type: 'exception',
            message: errorMessage,
          },
        };

        console.error(`[EXCEPTION] Block ${block.id}:`, JSON.stringify(diag));
        
        await supabase
          .from('lineblock_translations')
          .update({
            status: 'failed',
            error: JSON.stringify(diag.error),
          })
          .eq('lineblock_id', block.id)
          .eq('style', STYLE);

        return diag;
      }
    });

    const results = await Promise.all(batchPromises);
    
    results.forEach(diag => {
      blockDiagnostics.push(diag);
      if (diag.success) {
        processed++;
      } else if (diag.skipped_too_long) {
        skippedTooLong++;
      } else {
        errors++;
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      style: STYLE,
      model: MODEL,
      max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
      max_char_length_threshold: MAX_CHAR_LENGTH,
      total: lineBlocks.length,
      already_complete: existingIds.size,
      processed,
      errors,
      skipped_too_long: skippedTooLong,
      has_more: hasMore,
      remaining: missingBlocks.length - blocksToProcess.length,
      block_diagnostics: blockDiagnostics,
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
