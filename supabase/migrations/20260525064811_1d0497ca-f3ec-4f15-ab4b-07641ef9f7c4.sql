
DROP POLICY IF EXISTS "Authenticated users can view all reimbursements" ON public.reimbursement_requests;

CREATE POLICY "Users can view their own reimbursements"
ON public.reimbursement_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all reimbursements"
ON public.reimbursement_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
