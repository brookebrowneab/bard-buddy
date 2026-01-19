-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view lineblock_edit_audit" ON public.lineblock_edit_audit;

-- Create admin-only SELECT policy
CREATE POLICY "Admins can view lineblock_edit_audit"
ON public.lineblock_edit_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));