export interface Scene {
  id: string;
  title: string;
  source_pdf: string | null;
  pdf_text_raw: string | null;
  normalized_text: string | null;
  created_at: string;
}

export interface Character {
  id: string;
  name: string;
  scene_id: string;
  created_at: string;
}

export interface LineBlock {
  id: string;
  scene_id: string;
  order_index: number;
  speaker_name: string;
  text_raw: string;
  preceding_cue_raw: string | null;
  modern_hint: string | null;
  created_at: string;
}

export interface StageDirection {
  id: string;
  scene_id: string;
  order_index: number;
  text_raw: string;
  created_at: string;
}

export interface PracticeAttempt {
  id: string;
  scene_id: string;
  character_name: string;
  lineblock_id: string | null;
  mode: string;
  success: boolean;
  created_at: string;
}

// For parsing - before saving to DB
export interface ParsedLineBlock {
  order_index: number;
  speaker_name: string;
  text_raw: string;
  preceding_cue_raw: string | null;
}

export interface ParsedStageDirection {
  order_index: number;
  text_raw: string;
}

export interface ParseResult {
  normalized_text: string;
  line_blocks: ParsedLineBlock[];
  stage_directions: ParsedStageDirection[];
  characters: string[];
}
