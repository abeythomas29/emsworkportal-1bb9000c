-- Change defaults: new employees start with 0 casual and 0 earned leave
ALTER TABLE public.leave_balances ALTER COLUMN casual_leave SET DEFAULT 0;
ALTER TABLE public.leave_balances ALTER COLUMN earned_leave SET DEFAULT 0;

-- Update trigger to insert explicit zeros (defensive)
CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.leave_balances (user_id, casual_leave, earned_leave, lwp_taken, consecutive_work_days)
  VALUES (NEW.id, 0, 0, 0, 0);
  RETURN NEW;
END;
$function$;
