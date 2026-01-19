-- Fix RLS policies: public read, admin-only write

-- SCENES table
DROP POLICY IF EXISTS "Allow all access to scenes" ON public.scenes;
CREATE POLICY "Public read scenes" ON public.scenes FOR SELECT USING (true);
CREATE POLICY "Admins manage scenes" ON public.scenes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update scenes" ON public.scenes FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete scenes" ON public.scenes FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- CHARACTERS table
DROP POLICY IF EXISTS "Allow all access to characters" ON public.characters;
CREATE POLICY "Public read characters" ON public.characters FOR SELECT USING (true);
CREATE POLICY "Admins manage characters" ON public.characters FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update characters" ON public.characters FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete characters" ON public.characters FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- LINE_BLOCKS table
DROP POLICY IF EXISTS "Allow all access to line_blocks" ON public.line_blocks;
CREATE POLICY "Public read line_blocks" ON public.line_blocks FOR SELECT USING (true);
CREATE POLICY "Admins manage line_blocks" ON public.line_blocks FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update line_blocks" ON public.line_blocks FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete line_blocks" ON public.line_blocks FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- STAGE_DIRECTIONS table
DROP POLICY IF EXISTS "Allow all access to stage_directions" ON public.stage_directions;
CREATE POLICY "Public read stage_directions" ON public.stage_directions FOR SELECT USING (true);
CREATE POLICY "Admins manage stage_directions" ON public.stage_directions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update stage_directions" ON public.stage_directions FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete stage_directions" ON public.stage_directions FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- SCRIPT_SECTIONS table
DROP POLICY IF EXISTS "Allow all access to script_sections" ON public.script_sections;
CREATE POLICY "Public read script_sections" ON public.script_sections FOR SELECT USING (true);
CREATE POLICY "Admins manage script_sections" ON public.script_sections FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update script_sections" ON public.script_sections FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete script_sections" ON public.script_sections FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- PRODUCTIONS table
DROP POLICY IF EXISTS "Allow all write access to productions" ON public.productions;
DROP POLICY IF EXISTS "Allow public read access to productions" ON public.productions;
CREATE POLICY "Public read productions" ON public.productions FOR SELECT USING (true);
CREATE POLICY "Admins manage productions" ON public.productions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update productions" ON public.productions FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete productions" ON public.productions FOR DELETE USING (has_role(auth.uid(), 'admin'));