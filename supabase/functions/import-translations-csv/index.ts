import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslationRow {
  lineblock_id: string;
  style: string;
  translation_text: string | null;
  model: string | null;
  prompt_version: string | null;
  status: string;
  error: string | null;
  review_status: string;
  source: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csv_content } = await req.json();
    
    if (!csv_content) {
      return new Response(
        JSON.stringify({ error: "csv_content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lines = csv_content.split('\n').filter((line: string) => line.trim());
    const header = parseCSVLine(lines[0]);
    
    // Validate header
    const expectedColumns = ['lineblock_id', 'style', 'translation_text', 'model', 'prompt_version', 'status', 'error', 'review_status', 'source'];
    const columnIndices: Record<string, number> = {};
    for (const col of expectedColumns) {
      const idx = header.indexOf(col);
      if (idx === -1) {
        return new Response(
          JSON.stringify({ error: `Missing required column: ${col}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      columnIndices[col] = idx;
    }

    const rows: TranslationRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < header.length) continue;
      
      const translationText = values[columnIndices['translation_text']];
      // Remove surrounding quotes if present
      const cleanedText = translationText.startsWith('"') && translationText.endsWith('"') 
        ? translationText.slice(1, -1).replace(/""/g, '"')
        : translationText;
      
      rows.push({
        lineblock_id: values[columnIndices['lineblock_id']],
        style: values[columnIndices['style']],
        translation_text: cleanedText || null,
        model: values[columnIndices['model']] || null,
        prompt_version: values[columnIndices['prompt_version']] || null,
        status: values[columnIndices['status']] || 'complete',
        error: values[columnIndices['error']] || null,
        review_status: values[columnIndices['review_status']] || 'needs_review',
        source: values[columnIndices['source']] || 'ai',
      });
    }

    // Upsert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('lineblock_translations')
        .upsert(
          batch.map(row => ({
            lineblock_id: row.lineblock_id,
            style: row.style,
            translation_text: row.translation_text,
            model: row.model,
            prompt_version: row.prompt_version,
            status: row.status,
            error: row.error,
            review_status: row.review_status,
            source: row.source,
          })),
          { 
            onConflict: 'lineblock_id,style',
            ignoreDuplicates: false 
          }
        )
        .select();

      if (error) {
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_rows: rows.length,
        processed: inserted,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Import error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
