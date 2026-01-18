-- Create script_issues table for flagging parser issues
CREATE TABLE public.script_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineblock_id uuid NOT NULL REFERENCES public.line_blocks(id) ON DELETE CASCADE,
  issue_type text NOT NULL CHECK (issue_type IN ('wrong_speaker', 'needs_split', 'needs_merge', 'wrong_order', 'stage_direction_misparsed', 'duplicate_text', 'other')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create lineblock_edit_audit table for tracking split/merge/edit actions
CREATE TABLE public.lineblock_edit_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineblock_id uuid NOT NULL REFERENCES public.line_blocks(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('split', 'merge', 'edit')),
  field_name text,
  old_value text,
  new_value text,
  reason text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.script_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineblock_edit_audit ENABLE ROW LEVEL SECURITY;

-- RLS for script_issues: Admins can do all, others can view
CREATE POLICY "Admins can manage script_issues"
  ON public.script_issues
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view script_issues"
  ON public.script_issues
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS for lineblock_edit_audit: Admins can do all, others can view
CREATE POLICY "Admins can manage lineblock_edit_audit"
  ON public.lineblock_edit_audit
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view lineblock_edit_audit"
  ON public.lineblock_edit_audit
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX idx_script_issues_lineblock_id ON public.script_issues(lineblock_id);
CREATE INDEX idx_script_issues_status ON public.script_issues(status);
CREATE INDEX idx_lineblock_edit_audit_lineblock_id ON public.lineblock_edit_audit(lineblock_id);

-- Trigger for updated_at on script_issues
CREATE TRIGGER update_script_issues_updated_at
  BEFORE UPDATE ON public.script_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();