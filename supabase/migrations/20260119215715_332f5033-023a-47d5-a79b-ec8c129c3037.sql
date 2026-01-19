-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read translations" ON public.lineblock_translations;

-- Create a permissive public read policy for translations
CREATE POLICY "Public read translations" 
ON public.lineblock_translations 
FOR SELECT 
USING (true);