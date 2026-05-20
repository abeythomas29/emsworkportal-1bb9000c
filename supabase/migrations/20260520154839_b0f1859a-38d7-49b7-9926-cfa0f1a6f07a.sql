ALTER TABLE public.leave_balances ALTER COLUMN casual_leave SET DEFAULT 12;

CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.leave_balances (user_id, casual_leave, earned_leave, lwp_taken, consecutive_work_days)
  VALUES (NEW.id, 12, 0, 0, 0);
  RETURN NEW;
END;
$function$;

UPDATE public.leave_balances SET casual_leave = 12 WHERE casual_leave = 0;