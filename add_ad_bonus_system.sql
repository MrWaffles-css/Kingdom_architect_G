-- Migration to add ad_bonus_ends_at to user_stats and create RPC for activating it

-- 1. Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'ad_bonus_ends_at') THEN
        ALTER TABLE public.user_stats ADD COLUMN ad_bonus_ends_at timestamptz;
    END IF;
END $$;

-- 2. Create RPC function to activate the bonus
CREATE OR REPLACE FUNCTION public.activate_ad_bonus()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_new_end_time timestamptz;
    v_result json;
BEGIN
    v_user_id := auth.uid();
    
    -- Set bonus to expire in 2 hours form NOW
    v_new_end_time := NOW() + interval '2 hours';
    
    UPDATE public.user_stats
    SET ad_bonus_ends_at = v_new_end_time,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    -- Return the new state
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_ad_bonus() TO authenticated;
