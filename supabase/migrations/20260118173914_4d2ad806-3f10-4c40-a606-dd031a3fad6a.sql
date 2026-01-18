-- Create app_role enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table for admin access control
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create lineblock_translations table
CREATE TABLE public.lineblock_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineblock_id uuid REFERENCES public.line_blocks(id) ON DELETE CASCADE NOT NULL,
  style text NOT NULL DEFAULT 'plain_english',
  translation_text text,
  model text,
  prompt_version text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (lineblock_id, style)
);

-- Enable RLS on lineblock_translations
ALTER TABLE public.lineblock_translations ENABLE ROW LEVEL SECURITY;

-- RLS policies for lineblock_translations
CREATE POLICY "Anyone can read translations"
ON public.lineblock_translations
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage translations"
ON public.lineblock_translations
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create translation_jobs table to track bulk generation progress
CREATE TABLE public.translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES public.scenes(id) ON DELETE CASCADE NOT NULL,
  section_id uuid REFERENCES public.script_sections(id) ON DELETE SET NULL,
  style text NOT NULL DEFAULT 'plain_english',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error', 'cancelled')),
  total_lines integer NOT NULL DEFAULT 0,
  completed_lines integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on translation_jobs
ALTER TABLE public.translation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for translation_jobs
CREATE POLICY "Anyone can read translation jobs"
ON public.translation_jobs
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage translation jobs"
ON public.translation_jobs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on lineblock_translations
CREATE TRIGGER update_lineblock_translations_updated_at
BEFORE UPDATE ON public.lineblock_translations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on translation_jobs
CREATE TRIGGER update_translation_jobs_updated_at
BEFORE UPDATE ON public.translation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_lineblock_translations_lineblock_id ON public.lineblock_translations(lineblock_id);
CREATE INDEX idx_lineblock_translations_status ON public.lineblock_translations(status);
CREATE INDEX idx_translation_jobs_scene_id ON public.translation_jobs(scene_id);
CREATE INDEX idx_translation_jobs_status ON public.translation_jobs(status);