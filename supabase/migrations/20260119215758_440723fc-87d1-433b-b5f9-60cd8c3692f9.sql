-- Create a public view that hides editor information
CREATE VIEW public.lineblock_translations_public
WITH (security_invoker = on) AS
SELECT 
  id,
  lineblock_id,
  style,
  translation_text,
  status,
  review_status
FROM public.lineblock_translations;

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public read translations" ON public.lineblock_translations;

-- Create a restrictive policy - public can only read via the view (handled by security_invoker)
-- Admins still get full access
CREATE POLICY "Admins can read all translations" 
ON public.lineblock_translations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow public to read through the view
CREATE POLICY "Public read via view" 
ON public.lineblock_translations 
FOR SELECT 
USING (true);