import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineBlock {
  order_index: number;
  speaker_name: string;
  text_raw: string;
  preceding_cue_raw: string | null;
}

interface StageDirection {
  order_index: number;
  text_raw: string;
}

interface ParseResult {
  normalized_text: string;
  line_blocks: LineBlock[];
  stage_directions: StageDirection[];
  characters: string[];
}

// Known character names from play scripts (common patterns)
const KNOWN_SPEAKER_PATTERNS = [
  'Messenger', 'First', 'Second', 'Third', 'Servant', 'Attendant', 'Officer',
  'Guard', 'Watchman', 'Soldier', 'Gentleman', 'Lady', 'Lord', 'Duke', 'King',
  'Queen', 'Prince', 'Princess', 'Nurse', 'Friar', 'Boy', 'Girl', 'Man', 'Woman',
  'Chorus', 'Prologue', 'Epilogue', 'Captain', 'Page', 'Clown'
];

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

  // Check if it starts with a known speaker pattern (handles title-case like "Messenger")
  for (const pattern of KNOWN_SPEAKER_PATTERNS) {
    if (candidate === pattern || candidate.startsWith(pattern + ' ')) {
      return true;
    }
  }

  // Check if mostly uppercase letters (allow apostrophes, hyphens, spaces)
  const cleanedLine = candidate.replace(/[\s'-]/g, '');
  const isUppercase =
    cleanedLine === cleanedLine.toUpperCase() && /^[A-Z]+$/.test(cleanedLine);

  // Also accept single title-case words that look like names (1-2 words, capitalized)
  const isTitleCaseName = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(candidate);

  return isUppercase || isTitleCaseName;
}

// Helper: detect "INLINE" speaker starts like "LEONATO I learn..." or "Messenger He is..."
function parseInlineSpeakerStart(line: string): { speakerLabel: string; rest: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Match uppercase speakers: "DON PEDRO ..." or "FIRST WATCHMAN ..."
  const upperMatch = trimmed.match(/^([A-Z][A-Z'\- ]{1,40}?)[.:]?\s+(.+)$/);
  if (upperMatch) {
    const speakerLabel = upperMatch[1].trim().replace(/[\s]+/g, ' ');
    const rest = (upperMatch[2] ?? '').trim();
    if (isSpeakerLabel(speakerLabel) && rest) {
      return { speakerLabel, rest };
    }
  }

  // Match title-case speakers: "Messenger He is..." or known patterns
  const titleMatch = trimmed.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[.:]?\s+(.+)$/);
  if (titleMatch) {
    const speakerLabel = titleMatch[1].trim();
    const rest = (titleMatch[2] ?? '').trim();
    if (isSpeakerLabel(speakerLabel) && rest) {
      return { speakerLabel, rest };
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
  return trimmed.startsWith('ACT') || trimmed.startsWith('SCENE');
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
  const lines = text.split('\n');
  const lineCount: Map<string, number> = new Map();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 100) {
      lineCount.set(trimmed, (lineCount.get(trimmed) || 0) + 1);
    }
  }
  
  const repeatedLines = new Set<string>();
  for (const [line, count] of lineCount) {
    if (count >= 3) {
      repeatedLines.add(line);
    }
  }
  
  // 4. Remove page numbers and repeated lines
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
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

// STEP 2 & 3: Parse into blocks
function parseIntoBlocks(normalizedText: string): { lineBlocks: LineBlock[], stageDirections: StageDirection[], characters: Set<string> } {
  console.log('Step 2 & 3: Parsing into blocks...');
  
  const lines = normalizedText.split('\n');
  const lineBlocks: LineBlock[] = [];
  const stageDirections: StageDirection[] = [];
  const characters = new Set<string>();
  
  let orderIndex = 0;
  let currentSpeaker: string | null = null;
  let currentDialogue: string[] = [];

  const normalizeSpeakerName = (label: string) =>
    label
      .trim()
      .replace(/[.:]$/, '')
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  
  const flushCurrentBlock = () => {
    if (currentSpeaker && currentDialogue.length > 0) {
      const textRaw = currentDialogue.join(' ').trim();
      if (textRaw) {
        lineBlocks.push({
          order_index: orderIndex,
          speaker_name: currentSpeaker,
          text_raw: textRaw,
          preceding_cue_raw: null // Will be computed in step 4
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
    
    // Skip act/scene headings
    if (isActOrSceneHeading(trimmed)) {
      flushCurrentBlock();
      currentSpeaker = null;
      continue;
    }
    
    // Handle stage directions
    if (isStageDirection(trimmed)) {
      // Don't flush current block - just record the stage direction
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
  
  return { lineBlocks, stageDirections, characters };
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
  
  // Steps 2 & 3: Parse into blocks
  const { lineBlocks, stageDirections, characters } = parseIntoBlocks(normalizedText);
  console.log('Found', lineBlocks.length, 'line blocks');
  console.log('Found', stageDirections.length, 'stage directions');
  console.log('Found', characters.size, 'characters');
  
  // Step 4: Compute cues
  const blocksWithCues = computeCues(lineBlocks);
  
  return {
    normalized_text: normalizedText,
    line_blocks: blocksWithCues,
    stage_directions: stageDirections,
    characters: Array.from(characters)
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
