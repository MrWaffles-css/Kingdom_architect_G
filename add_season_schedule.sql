-- add_season_schedule.sql

-- 1. Create the season_schedule table
CREATE TABLE IF NOT EXISTS public.season_schedule (
    id integer PRIMARY KEY DEFAULT 1,
    end_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT season_schedule_id_check CHECK (id = 1) -- Ensure only one row exists
);

-- 2. Enable RLS
ALTER TABLE public.season_schedule ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Allow anyone to read
CREATE POLICY "Anyone can read season schedule" 
ON public.season_schedule FOR SELECT 
USING (true);

-- Allow admins to update (assuming is_admin check or similar, checking profiles)
-- For simplicity in this step, we'll restrict via the RPC function usage and rely on the fact that only AdminPanel calls the setter.
-- But proper RLS for direct updates:
CREATE POLICY "Admins can update season schedule" 
ON public.season_schedule FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
    )
);

CREATE POLICY "Admins can insert season schedule" 
ON public.season_schedule FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.is_admin = true
    )
);

-- 4. RPC to set the time (upsert)
CREATE OR REPLACE FUNCTION public.set_season_end_time(p_end_time timestamp with time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Only admins can schedule the season end.';
    END IF;

    INSERT INTO public.season_schedule (id, end_time, updated_at)
    VALUES (1, p_end_time, now())
    ON CONFLICT (id) 
    DO UPDATE SET 
        end_time = EXCLUDED.end_time,
        updated_at = now();
END;
$$;

-- 5. RPC to get the time (convenience, though could select directly)
CREATE OR REPLACE FUNCTION public.get_season_end_time()
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT end_time FROM public.season_schedule WHERE id = 1;
$$;
