
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS additional_departments text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.is_production_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND COALESCE(is_active, true) = true
      AND (
        LOWER(COALESCE(department, '')) = 'production'
        OR 'production' = ANY (SELECT LOWER(d) FROM unnest(COALESCE(additional_departments, '{}')) d)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_research_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND COALESCE(is_active, true) = true
      AND (
        LOWER(COALESCE(department, '')) = 'research'
        OR 'research' = ANY (SELECT LOWER(d) FROM unnest(COALESCE(additional_departments, '{}')) d)
      )
  );
$function$;
