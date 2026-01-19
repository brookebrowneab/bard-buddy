import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineBlock {
  order_index: number;
  speaker_name: string;
  text_raw: string;
  preceding_cue_raw: string | null;
  section_index?: number; // Which section (act/scene) this line belongs to
}

interface StageDirection {
  order_index: number;
  text_raw: string;
}

interface ParsedSection {
  title: string;
  act_number: number | null;
  scene_number: number | null;
  order_index: number;
}

interface ParseResult {
  normalized_text: string;
  line_blocks: LineBlock[];
  stage_directions: StageDirection[];
  characters: string[];
  sections: ParsedSection[];
}

// Known character names from play scripts (common patterns)
const KNOWN_SPEAKER_PATTERNS = [
  'Messenger',
  'Servant',
  'Attendant',
  'Officer',
  'Guard',
  'Watchman',
  'Soldier',
  'Gentleman',
  'Lady',
  'Lord',
  'Duke',
  'King',
  'Queen',
  'Prince',
  'Princess',
  'Nurse',
  'Friar',
  'Boy',
  'Girl',
  'Man',
  'Woman',
  'Chorus',
  'Prologue',
  'Epilogue',
  'Captain',
  'Page',
  'Clown',
  'First',
  'Second',
  'Third'
];

function isKnownRoleSpeaker(candidate: string): boolean {
  // Exact single-word roles like "Messenger"
  if (KNOWN_SPEAKER_PATTERNS.includes(candidate)) return true;

  // Ordinal patterns like "First Watchman" / "Second Servant"
  const ordMatch = candidate.match(/^(First|Second|Third)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?$/);
  if (ordMatch) return true;

  // Roles with suffix numbers/roman numerals like "Servant 1" / "Servant II"
  const roleSuffixMatch = candidate.match(/^(Servant|Attendant|Officer|Guard|Watchman|Soldier)\s+(\d+|[IVX]+)$/);
  if (roleSuffixMatch) return true;

  return false;
}

// Helper: Check if a line is a speaker label
function isSpeakerLabel(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Allow common punctuation on label-only lines: "LEONATO." / "LEONATO:"
  const candidate = trimmed.replace(/[.:]$/, '').trim();
  if (candidate.length < 2 || candidate.length > 30) return false;

  // Exclude stage directions and scene headings
  const upperCandidate = candidate.toUpperCase();
  if (
    upperCandidate.startsWith('ACT') ||
    upperCandidate.startsWith('SCENE') ||
    upperCandidate.startsWith('ENTER') ||
    upperCandidate.startsWith('EXIT') ||
    upperCandidate.startsWith('EXEUNT') ||
    upperCandidate.startsWith('RE-ENTER')
  ) {
    return false;
  }

  // Primary signal: uppercase labels (typical scripts)
  const cleanedLine = candidate.replace(/[\s'-]/g, '');
  const isUppercase =
    cleanedLine === cleanedLine.toUpperCase() && /^[A-Z]+$/.test(cleanedLine);
  if (isUppercase) return true;

  // Secondary signal: a small allowlist for title-case role labels like "Messenger"
  // (Avoid treating normal dialogue like "Good Signior..." as a speaker.)
  return isKnownRoleSpeaker(candidate);
}

// Helper: detect "INLINE" speaker starts like "LEONATO I learn..." or "Messenger He is..."
// This is ONLY for scripts where speaker and dialogue are on the same line.
// We must be very strict to avoid false positives like "He is..." or "Good morning..."
function parseInlineSpeakerStart(line: string): { speakerLabel: string; rest: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Pattern 1: All-uppercase speaker followed by dialogue
  // e.g., "DON PEDRO Good Signior..." or "LEONATO: I learn..."
  // Must be at least 2 uppercase words OR a known uppercase name
  const upperMatch = trimmed.match(/^([A-Z][A-Z'\-]+(?:\s+[A-Z][A-Z'\-]+)*)[.:]?\s+(.+)$/);
  if (upperMatch) {
    const speakerLabel = upperMatch[1].trim().replace(/[\s]+/g, ' ');
    const rest = (upperMatch[2] ?? '').trim();
    // Validate it's truly a speaker (all uppercase, not a heading)
    const cleanedSpeaker = speakerLabel.replace(/[\s'-]/g, '');
    const isAllUppercase = cleanedSpeaker === cleanedSpeaker.toUpperCase() && /^[A-Z]+$/.test(cleanedSpeaker);
    if (isAllUppercase && !isActOrSceneHeading(speakerLabel) && !isStageDirection(speakerLabel) && rest) {
      return { speakerLabel, rest };
    }
  }

  // Pattern 2: Known title-case role speaker followed by dialogue
  // e.g., "Messenger He is..." or "First Watchman Who goes..."
  // ONLY match if the prefix is a known role - NOT arbitrary title-case words
  for (const role of KNOWN_SPEAKER_PATTERNS) {
    // Exact match: "Messenger He is..."
    const exactPattern = new RegExp(`^(${role})[.:]?\\s+(.+)$`);
    const exactMatch = trimmed.match(exactPattern);
    if (exactMatch) {
      return { speakerLabel: exactMatch[1], rest: exactMatch[2].trim() };
    }
    
    // Ordinal match: "First Watchman Who goes..."
    if (['First', 'Second', 'Third'].includes(role)) {
      const ordPattern = new RegExp(`^(${role}\\s+[A-Z][a-z]+)[.:]?\\s+(.+)$`);
      const ordMatch = trimmed.match(ordPattern);
      if (ordMatch && isKnownRoleSpeaker(ordMatch[1])) {
        return { speakerLabel: ordMatch[1], rest: ordMatch[2].trim() };
      }
    }
  }

  return null;
}

// Helper: Check if a line is a stage direction
function isStageDirection(line: string): boolean {
  const trimmed = line.trim();
  const upperTrimmed = trimmed.toUpperCase();
  
  // Check explicit patterns
  if (upperTrimmed.startsWith('ENTER') ||
      upperTrimmed.startsWith('EXIT') ||
      upperTrimmed.startsWith('EXEUNT') ||
      upperTrimmed.startsWith('RE-ENTER')) {
    return true;
  }
  
  // Check for bracketed directions
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('(') && trimmed.endsWith(')'))) {
    return true;
  }
  
  // Check for "Aside" pattern
  if (/\[.*Aside.*\]/i.test(trimmed)) {
    return true;
  }
  
  return false;
}

// Helper: Check if a line is an act/scene heading
function isActOrSceneHeading(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  return trimmed.startsWith('ACT') || trimmed.startsWith('SCENE') || trimmed.startsWith('TITLE');
}

// Helper: Parse an act/scene heading into structured data
function parseActSceneHeading(line: string): ParsedSection | null {
  const trimmed = line.trim();
  const upper = trimmed.toUpperCase();
  
  // Pattern: "ACT 1" or "ACT I" or "ACT ONE"
  const actMatch = upper.match(/^ACT\s+(\d+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE)/i);
  // Pattern: "SCENE 1" or "SCENE I" or "Scene 1"
  const sceneMatch = upper.match(/^SCENE\s+(\d+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE)/i);
  // Pattern: "ACT 1, SCENE 2" or "Act I Scene II"
  const combinedMatch = upper.match(/^ACT\s+(\d+|[IVXLC]+)\s*[,:]?\s*SCENE\s+(\d+|[IVXLC]+)/i);
  
  const parseNumber = (str: string): number => {
    // Arabic numerals
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    // Roman numerals
    const roman: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
    let value = 0;
    for (let i = 0; i < str.length; i++) {
      const curr = roman[str[i]] || 0;
      const next = roman[str[i + 1]] || 0;
      value += curr < next ? -curr : curr;
    }
    if (value > 0) return value;
    // Word form
    const words: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return words[str.toUpperCase()] || 0;
  };
  
  if (combinedMatch) {
    return {
      title: trimmed,
      act_number: parseNumber(combinedMatch[1]),
      scene_number: parseNumber(combinedMatch[2]),
      order_index: 0
    };
  }
  
  if (actMatch) {
    return {
      title: trimmed,
      act_number: parseNumber(actMatch[1]),
      scene_number: null,
      order_index: 0
    };
  }
  
  if (sceneMatch) {
    return {
      title: trimmed,
      act_number: null,
      scene_number: parseNumber(sceneMatch[1]),
      order_index: 0
    };
  }
  
  return null;
}

// Helper: Check if a line is just a page number
function isPageNumber(line: string): boolean {
  return /^\d+$/.test(line.trim());
}

// STEP 1: Normalize text
function normalizeText(rawText: string): string {
  console.log('Step 1: Normalizing text...');
  
  // 1. Replace Windows newlines with \n
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // 2. Convert multiple spaces/tabs to single space, keep line breaks
  text = text.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n');
  
  // 3. Remove repeated page headers/footers (lines identical on 3+ pages)
  // IMPORTANT: Do NOT treat speaker labels (e.g. "LEONATO:"), stage directions, or act/scene headings as headers.
  // Those repeat naturally and must be preserved.
  const lines = text.split('\n');
  const lineCount: Map<string, number> = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length >= 100) continue;

    // Skip boundaries that are expected to repeat in scripts
    if (isSpeakerLabel(trimmed) || parseInlineSpeakerStart(trimmed) || isActOrSceneHeading(trimmed) || isStageDirection(trimmed)) {
      continue;
    }

    lineCount.set(trimmed, (lineCount.get(trimmed) || 0) + 1);
  }

  const repeatedLines = new Set<string>();
  for (const [line, count] of lineCount) {
    if (count >= 3) {
      repeatedLines.add(line);
    }
  }

  // 4. Remove page numbers and repeated header/footer lines
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;

    // Never strip speaker labels / boundaries
    if (isSpeakerLabel(trimmed) || parseInlineSpeakerStart(trimmed) || isActOrSceneHeading(trimmed) || isStageDirection(trimmed)) {
      return true;
    }

    return !isPageNumber(trimmed) && !repeatedLines.has(trimmed);
  });
  
  // 5. Merge soft-wrapped dialogue lines
  const mergedLines: string[] = [];
  let i = 0;
  
  while (i < filteredLines.length) {
    const currentLine = filteredLines[i].trim();
    
    if (!currentLine) {
      i++;
      continue;
    }
    
    // If it's a speaker label (including inline-speaker start), act/scene heading, or stage direction, keep it separate
    const inlineStart = parseInlineSpeakerStart(currentLine);
    if (isSpeakerLabel(currentLine) || inlineStart || isActOrSceneHeading(currentLine) || isStageDirection(currentLine)) {
      mergedLines.push(currentLine);
      i++;
      continue;
    }

    // It's dialogue - merge with following non-boundary lines
    let dialogueBlock = currentLine;
    i++;

    while (i < filteredLines.length) {
      const nextLine = filteredLines[i].trim();

      const nextInlineStart = parseInlineSpeakerStart(nextLine);
      if (
        !nextLine ||
        isSpeakerLabel(nextLine) ||
        nextInlineStart ||
        isActOrSceneHeading(nextLine) ||
        isStageDirection(nextLine)
      ) {
        break;
      }

      dialogueBlock += ' ' + nextLine;
      i++;
    }

    mergedLines.push(dialogueBlock);
  }
  
  return mergedLines.join('\n');
}

// STEP 2 & 3: Parse into blocks with section tracking
function parseIntoBlocks(normalizedText: string): { 
  lineBlocks: LineBlock[], 
  stageDirections: StageDirection[], 
  characters: Set<string>,
  sections: ParsedSection[]
} {
  console.log('Step 2 & 3: Parsing into blocks...');
  
  const lines = normalizedText.split('\n');
  const lineBlocks: LineBlock[] = [];
  const stageDirections: StageDirection[] = [];
  const characters = new Set<string>();
  const sections: ParsedSection[] = [];
  
  let orderIndex = 0;
  let currentSpeaker: string | null = null;
  let currentDialogue: string[] = [];
  let currentSectionIndex = -1; // -1 means no section yet
  let currentActNumber: number | null = null;

  const normalizeSpeakerName = (label: string) =>
    label
      .trim()
      .replace(/[.:]$/, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  
  const flushCurrentBlock = () => {
    if (currentSpeaker && currentDialogue.length > 0) {
      const textRaw = currentDialogue.join(' ').trim();
      if (textRaw) {
        lineBlocks.push({
          order_index: orderIndex,
          speaker_name: currentSpeaker,
          text_raw: textRaw,
          preceding_cue_raw: null, // Will be computed in step 4
          section_index: currentSectionIndex >= 0 ? currentSectionIndex : undefined
        });
        characters.add(currentSpeaker);
        orderIndex++;
      }
    }
    currentDialogue = [];
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    // Handle act/scene headings - create a new section
    if (isActOrSceneHeading(trimmed)) {
      flushCurrentBlock();
      currentSpeaker = null;
      
      const sectionData = parseActSceneHeading(trimmed);
      if (sectionData) {
        // If this is just an ACT heading, remember the act number for subsequent scenes
        if (sectionData.act_number !== null && sectionData.scene_number === null) {
          currentActNumber = sectionData.act_number;
        }
        
        // If this is a SCENE heading without an act, inherit the current act
        if (sectionData.act_number === null && sectionData.scene_number !== null && currentActNumber !== null) {
          sectionData.act_number = currentActNumber;
          sectionData.title = `Act ${currentActNumber}, Scene ${sectionData.scene_number}`;
        }
        
        // Only create sections for scenes (with scene_number)
        if (sectionData.scene_number !== null) {
          sectionData.order_index = sections.length;
          sections.push(sectionData);
          currentSectionIndex = sections.length - 1;
        }
      }
      continue;
    }
    
    // Handle stage directions
    if (isStageDirection(trimmed)) {
      stageDirections.push({
        order_index: orderIndex,
        text_raw: trimmed
      });
      orderIndex++;
      continue;
    }
    
    // Handle speaker labels (label-only lines)
    if (isSpeakerLabel(trimmed)) {
      flushCurrentBlock();
      currentSpeaker = normalizeSpeakerName(trimmed);
      continue;
    }

    // Handle inline speaker starts like "LEONATO I learn..."
    const inlineStart = parseInlineSpeakerStart(trimmed);
    if (inlineStart) {
      flushCurrentBlock();
      currentSpeaker = normalizeSpeakerName(inlineStart.speakerLabel);
      currentDialogue = [inlineStart.rest];
      continue;
    }

    // It's dialogue
    if (currentSpeaker) {
      currentDialogue.push(trimmed);
    }
  }
  
  // Flush any remaining block
  flushCurrentBlock();
  
  // If no sections were found, create a default one
  if (sections.length === 0) {
    sections.push({
      title: 'Full Script',
      act_number: 1,
      scene_number: 1,
      order_index: 0
    });
    // Assign all lines to this section
    for (const block of lineBlocks) {
      block.section_index = 0;
    }
  }
  
  return { lineBlocks, stageDirections, characters, sections };
}

// STEP 4: Compute cues
function computeCues(lineBlocks: LineBlock[]): LineBlock[] {
  console.log('Step 4: Computing cues...');
  
  return lineBlocks.map((block, index) => {
    // Find the most recent prior LineBlock with a different speaker
    let precedingCue: string | null = null;
    
    for (let i = index - 1; i >= 0; i--) {
      if (lineBlocks[i].speaker_name !== block.speaker_name) {
        precedingCue = lineBlocks[i].text_raw;
        break;
      }
    }
    
    return {
      ...block,
      preceding_cue_raw: precedingCue
    };
  });
}

// Main parse function
function parseSceneText(pdfTextRaw: string): ParseResult {
  console.log('Starting PDF text parsing...');
  console.log('Raw text length:', pdfTextRaw.length);
  
  // Step 1: Normalize
  const normalizedText = normalizeText(pdfTextRaw);
  console.log('Normalized text length:', normalizedText.length);
  
  // Steps 2 & 3: Parse into blocks with sections
  const { lineBlocks, stageDirections, characters, sections } = parseIntoBlocks(normalizedText);
  console.log('Found', lineBlocks.length, 'line blocks');
  console.log('Found', stageDirections.length, 'stage directions');
  console.log('Found', characters.size, 'characters');
  console.log('Found', sections.length, 'sections');
  
  // Step 4: Compute cues
  const blocksWithCues = computeCues(lineBlocks);
  
  return {
    normalized_text: normalizedText,
    line_blocks: blocksWithCues,
    stage_directions: stageDirections,
    characters: Array.from(characters),
    sections
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin role from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's JWT to verify their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to check admin role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin role required for this operation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`PDF parse requested by admin ${user.id}`);

    const { pdf_text_raw, scene_title } = await req.json();

    if (!pdf_text_raw) {
      return new Response(
        JSON.stringify({ success: false, error: 'pdf_text_raw is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received scene title:', scene_title);
    console.log('PDF text length:', pdf_text_raw.length);

    // Parse the scene text
    const result = parseSceneText(pdf_text_raw);

    console.log('Parsing complete!');
    console.log('Characters:', result.characters);
    console.log('Line blocks:', result.line_blocks.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
