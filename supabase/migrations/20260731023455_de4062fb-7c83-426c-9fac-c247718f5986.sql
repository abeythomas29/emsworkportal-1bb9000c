DROP POLICY "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (is_active IS DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (employee_type IS DISTINCT FROM (SELECT p.employee_type FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (employee_id IS DISTINCT FROM (SELECT p.employee_id FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (ot_eligible IS DISTINCT FROM (SELECT p.ot_eligible FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (additional_departments IS DISTINCT FROM (SELECT p.additional_departments FROM public.profiles p WHERE p.id = auth.uid()))
  AND (
    NOT (joining_date IS DISTINCT FROM (SELECT p.joining_date FROM public.profiles p WHERE p.id = auth.uid()))
    OR (SELECT p.joining_date FROM public.profiles p WHERE p.id = auth.uid()) IS NULL
  )
);