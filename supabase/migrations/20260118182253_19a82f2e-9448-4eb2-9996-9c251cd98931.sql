-- Drop the old status check constraint
ALTER TABLE public.lineblock_translations DROP CONSTRAINT IF EXISTS lineblock_translations_status_check;

-- Add new columns
ALTER TABLE public.lineblock_translations 
ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'needs_review';

ALTER TABLE public.lineblock_translations 
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai';

ALTER TABLE public.lineblock_translations 
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

ALTER TABLE public.lineblock_translations 
ADD COLUMN IF NOT EXISTS edited_by_user_id uuid;

-- Update default for style column
ALTER TABLE public.lineblock_translations 
ALTER COLUMN style SET DEFAULT 'kid_modern_english_v1';

-- Update existing status values to new enum
UPDATE public.lineblock_translations SET status = 'pending' WHERE status = 'processing';
UPDATE public.lineblock_translations SET status = 'complete' WHERE status = 'completed';
UPDATE public.lineblock_translations SET status = 'failed' WHERE status = 'error';

-- Add new status check constraint with new enum values
ALTER TABLE public.lineblock_translations 
ADD CONSTRAINT lineblock_translations_status_check 
CHECK (status = ANY (ARRAY['missing'::text, 'pending'::text, 'complete'::text, 'failed'::text]));

-- Add review_status check constraint
ALTER TABLE public.lineblock_translations 
ADD CONSTRAINT lineblock_translations_review_status_check 
CHECK (review_status = ANY (ARRAY['needs_review'::text, 'approved'::text]));

-- Add source check constraint
ALTER TABLE public.lineblock_translations 
ADD CONSTRAINT lineblock_translations_source_check 
CHECK (source = ANY (ARRAY['ai'::text, 'manual'::text, 'ai_edited'::text]));

-- Update default for status column
ALTER TABLE public.lineblock_translations 
ALTER COLUMN status SET DEFAULT 'missing';

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Admins can manage translations" ON public.lineblock_translations;
DROP POLICY IF EXISTS "Anyone can read translations" ON public.lineblock_translations;

-- Create new RLS policies
CREATE POLICY "Authenticated users can read translations" 
ON public.lineblock_translations 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert translations" 
ON public.lineblock_translations 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update translations" 
ON public.lineblock_translations 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete translations" 
ON public.lineblock_translations 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));