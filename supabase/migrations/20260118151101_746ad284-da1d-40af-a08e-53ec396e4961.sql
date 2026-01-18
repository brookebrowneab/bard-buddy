-- Add a "script" table (the full uploaded script, admin-only)
-- Rename existing "scenes" table use to "script_sections" for act/scene segments

-- First, create the new script_sections table that references scenes as the parent script
CREATE TABLE public.script_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  title text NOT NULL,  -- e.g., "Act 1, Scene 1"
  act_number integer,
  scene_number integer,
  order_index integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.script_sections ENABLE ROW LEVEL SECURITY;

-- Allow all access (no auth in this app)
CREATE POLICY "Allow all access to script_sections"
ON public.script_sections
FOR ALL
USING (true)
WITH CHECK (true);

-- Add script_section_id to line_blocks to associate lines with specific act/scene
ALTER TABLE public.line_blocks ADD COLUMN section_id uuid REFERENCES public.script_sections(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX idx_line_blocks_section_id ON public.line_blocks(section_id);
CREATE INDEX idx_script_sections_scene_id ON public.script_sections(scene_id);