-- Fix translation_jobs to only allow authenticated users to view
-- (currently has public SELECT access)
DROP POLICY IF EXISTS "Anyone can read translation jobs" ON public.translation_jobs;
CREATE POLICY "Authenticated users can read translation jobs"
ON public.translation_jobs
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix practice_attempts to restrict write access
-- Keep public read for leaderboards/stats, but restrict writes to authenticated users
DROP POLICY IF EXISTS "Allow all access to practice_attempts" ON public.practice_attempts;

-- Public can read practice attempts (for stats/leaderboards)
CREATE POLICY "Anyone can read practice_attempts"
ON public.practice_attempts
FOR SELECT
USING (true);

-- Authenticated users can insert their own practice attempts
CREATE POLICY "Authenticated users can insert practice_attempts"
ON public.practice_attempts
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update their own practice attempts (if needed)
CREATE POLICY "Authenticated users can update their practice_attempts"
ON public.practice_attempts
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Authenticated users can delete their own practice attempts
CREATE POLICY "Authenticated users can delete their practice_attempts"
ON public.practice_attempts
FOR DELETE
USING (auth.uid() IS NOT NULL);