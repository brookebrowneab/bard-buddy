-- Make practice_attempts admin-only since it's not currently used
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read practice_attempts" ON public.practice_attempts;
DROP POLICY IF EXISTS "Authenticated users can insert practice_attempts" ON public.practice_attempts;
DROP POLICY IF EXISTS "Authenticated users can update their practice_attempts" ON public.practice_attempts;
DROP POLICY IF EXISTS "Authenticated users can delete their practice_attempts" ON public.practice_attempts;

-- Admin-only policies for practice_attempts
CREATE POLICY "Admins can manage practice_attempts"
ON public.practice_attempts
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));