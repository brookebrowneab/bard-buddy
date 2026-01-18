-- Scene table to store uploaded PDF scenes
CREATE TABLE public.scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Scene',
  source_pdf TEXT,
  pdf_text_raw TEXT,
  normalized_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Character table for extracted characters
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- LineBlock table for parsed dialogue blocks
CREATE TABLE public.line_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  speaker_name TEXT NOT NULL,
  text_raw TEXT NOT NULL,
  preceding_cue_raw TEXT,
  modern_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- StageDirection table for stage directions (not memorization targets)
CREATE TABLE public.stage_directions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  text_raw TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PracticeAttempt table for tracking practice sessions
CREATE TABLE public.practice_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  lineblock_id UUID REFERENCES public.line_blocks(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow all operations (no user accounts)
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required)
CREATE POLICY "Allow all access to scenes" ON public.scenes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to characters" ON public.characters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to line_blocks" ON public.line_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to stage_directions" ON public.stage_directions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to practice_attempts" ON public.practice_attempts FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_characters_scene_id ON public.characters(scene_id);
CREATE INDEX idx_line_blocks_scene_id ON public.line_blocks(scene_id);
CREATE INDEX idx_line_blocks_order ON public.line_blocks(scene_id, order_index);
CREATE INDEX idx_stage_directions_scene_id ON public.stage_directions(scene_id);
CREATE INDEX idx_practice_attempts_scene ON public.practice_attempts(scene_id, character_name);