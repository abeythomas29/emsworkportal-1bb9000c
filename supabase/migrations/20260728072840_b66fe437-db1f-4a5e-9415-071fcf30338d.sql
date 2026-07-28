DROP POLICY IF EXISTS "Users can insert their own OT requests" ON public.ot_requests;

CREATE POLICY "Users can insert their own OT requests"
ON public.ot_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    status = 'pending'
    OR (status = 'approved' AND ot_type LIKE 'auto_%')
  )
);