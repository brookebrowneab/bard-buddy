-- Create function to update timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create productions table
CREATE TABLE public.productions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active_scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

-- Allow public read access (no auth required for now)
CREATE POLICY "Allow public read access to productions"
ON public.productions
FOR SELECT
USING (true);

-- Allow all write access for admin operations
CREATE POLICY "Allow all write access to productions"
ON public.productions
FOR ALL
USING (true)
WITH CHECK (true);

-- Add production_id to scenes table to link scenes to productions
ALTER TABLE public.scenes
ADD COLUMN production_id UUID REFERENCES public.productions(id) ON DELETE SET NULL;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_productions_updated_at
BEFORE UPDATE ON public.productions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the initial production for Much Ado About Nothing
INSERT INTO public.productions (name, description, active_scene_id)
VALUES (
  'Much Ado About Nothing',
  'Our current production of Shakespeare''s beloved comedy',
  '50a7da57-4f4d-4671-b9ca-f32f8c1cc42e'
);

-- Link the active script to this production
UPDATE public.scenes
SET production_id = (SELECT id FROM public.productions WHERE name = 'Much Ado About Nothing' LIMIT 1)
WHERE id = '50a7da57-4f4d-4671-b9ca-f32f8c1cc42e';