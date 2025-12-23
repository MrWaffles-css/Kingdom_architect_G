-- Function to upgrade spy report research
-- Cost: 5000 * (current_level + 1) XP
-- Max Level: 5

CREATE OR REPLACE FUNCTION public.upgrade_research_spy_report()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats record;
    v_cost int;
    v_new_level int;
BEGIN
    v_user_id := auth.uid();

    -- Get user stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;

    -- Calculate next level and cost
    -- Current Level 0 -> Next Level 1 -> Cost 5000
    -- Current Level 1 -> Next Level 2 -> Cost 10000
    v_new_level := COALESCE(v_stats.research_spy_report, 0) + 1;
    v_cost := 5000 * v_new_level;

    -- Validation
    IF v_new_level > 5 THEN
        RAISE EXCEPTION 'Max level of 5 reached for Spy Reports';
    END IF;

    IF v_stats.experience < v_cost THEN
        RAISE EXCEPTION 'Not enough XP. Need % XP', v_cost;
    END IF;

    -- Update
    UPDATE public.user_stats 
    SET 
        experience = experience - v_cost,
        research_spy_report = v_new_level
    WHERE id = v_user_id;

    -- Return updated stats for frontend
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    RETURN row_to_json(v_stats);
END;
$$;
