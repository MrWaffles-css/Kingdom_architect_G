-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.library_levels (
    level INT PRIMARY KEY,
    upgrade_cost BIGINT, -- Cost to upgrade to NEXT level
    xp_rate INT -- XP per minute generated AT this level
);

-- 2. Seed Data (Upsert to preserve edits if we run this again, but for now just insert default)
INSERT INTO public.library_levels (level, upgrade_cost, xp_rate) VALUES
(1, 100000, 1),
(2, 300000, 2),
(3, 600000, 3),
(4, 900000, 4),
(5, 2000000, 5),
(6, 5000000, 6),
(7, 25000000, 7),
(8, 50000000, 8),
(9, 100000000, 9),
(10, 0, 10) -- Max level, cost 0 implies max
ON CONFLICT (level) DO NOTHING;

-- 3. Update generate_resources to use table
CREATE OR REPLACE FUNCTION public.generate_resources()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats RECORD;
    v_now timestamptz;
    v_last_regen timestamptz;
    v_elapsed_seconds numeric;
    v_minutes_passed integer;
    
    -- Resource gains
    v_citizen_gain integer;
    v_gold_gain bigint;
    v_xp_gain bigint;
    v_turn_gain integer;
    v_vault_gain bigint;
    
    -- Gold generation components
    v_untrained_gold bigint;
    v_trained_gold bigint;
    v_miner_gold bigint;
    v_miner_rate integer;
    v_trained_count integer;
    
    -- Vault calculations
    v_vault_level integer;
    v_interest_rate numeric;
    v_vault_capacity bigint;
    v_current_vault bigint;
    v_is_over_capacity boolean;
    v_new_vault bigint;
    
    v_result json;
    
    -- Library components
    v_lib_rate int;
BEGIN
    v_user_id := auth.uid();
    v_now := NOW();
    
    -- Get current stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    
    IF v_stats IS NULL THEN
        RAISE EXCEPTION 'User stats not found';
    END IF;
    
    -- Calculate time elapsed since last REGEN (not updated_at)
    v_last_regen := COALESCE(v_stats.last_resource_generation, v_stats.updated_at, v_now);
    
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_regen));
    v_minutes_passed := FLOOR(v_elapsed_seconds / 60);
    
    -- If less than 1 minute has passed, return current stats
    IF v_minutes_passed < 1 THEN
        SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
        RETURN v_result;
    END IF;
    
    -- =====================================================
    -- CITIZEN GENERATION
    -- =====================================================
    v_citizen_gain := FLOOR(COALESCE(v_stats.kingdom_level, 0) * 1) * v_minutes_passed;
    
    -- =====================================================
    -- GOLD GENERATION
    -- =====================================================
    v_untrained_gold := FLOOR(COALESCE(v_stats.citizens, 0) * 1) * v_minutes_passed;
    
    v_trained_count := COALESCE(v_stats.attack_soldiers, 0) + 
                       COALESCE(v_stats.defense_soldiers, 0) + 
                       COALESCE(v_stats.spies, 0) + 
                       COALESCE(v_stats.sentries, 0);
    v_trained_gold := FLOOR(v_trained_count * 0.5) * v_minutes_passed;
    
    v_miner_rate := 2 + GREATEST(0, COALESCE(v_stats.gold_mine_level, 1) - 1);
    v_miner_gold := COALESCE(v_stats.miners, 0) * v_miner_rate * v_minutes_passed;
    
    v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
    
    -- =====================================================
    -- VAULT INTEREST
    -- =====================================================
    v_vault_level := COALESCE(v_stats.vault_level, 0);
    v_interest_rate := 0;
    v_vault_capacity := 0;
    
    IF v_vault_level > 0 THEN
        v_interest_rate := LEAST(0.50, v_vault_level * 0.05);
        IF v_vault_level = 1 THEN v_vault_capacity := 100000;
        ELSIF v_vault_level = 2 THEN v_vault_capacity := 500000;
        ELSIF v_vault_level = 3 THEN v_vault_capacity := 1500000;
        ELSIF v_vault_level = 4 THEN v_vault_capacity := 5000000;
        ELSIF v_vault_level = 5 THEN v_vault_capacity := 15000000;
        ELSIF v_vault_level = 6 THEN v_vault_capacity := 50000000;
        ELSIF v_vault_level = 7 THEN v_vault_capacity := 150000000;
        ELSIF v_vault_level = 8 THEN v_vault_capacity := 500000000;
        ELSIF v_vault_level = 9 THEN v_vault_capacity := 1500000000;
        ELSIF v_vault_level >= 10 THEN v_vault_capacity := 5000000000;
        END IF;
    END IF;
    
    v_current_vault := COALESCE(v_stats.vault, 0);
    v_is_over_capacity := v_current_vault > v_vault_capacity;
    
    IF v_is_over_capacity THEN
        v_vault_gain := 0;
        v_new_vault := v_current_vault; 
    ELSE
        v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
        v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
    END IF;
    
    -- =====================================================
    -- EXPERIENCE GENERATION (Dynamic)
    -- =====================================================
    SELECT xp_rate INTO v_lib_rate FROM public.library_levels WHERE level = COALESCE(v_stats.library_level, 1);
    IF v_lib_rate IS NULL THEN v_lib_rate := 1; END IF;
    
    v_xp_gain := v_lib_rate * v_minutes_passed;
    
    -- =====================================================
    -- TURN GENERATION
    -- =====================================================
    DECLARE
        v_turns_per_min int;
        v_res_level int;
    BEGIN
        v_res_level := COALESCE(v_stats.research_turns_per_min, 0);
        v_turns_per_min := 2 + v_res_level;
        v_turn_gain := v_turns_per_min * v_minutes_passed;
    END;

    -- =====================================================
    -- UPDATE DATABASE
    -- =====================================================
    UPDATE public.user_stats
    SET 
        citizens = citizens + v_citizen_gain,
        gold = gold + v_gold_gain,
        vault = v_new_vault,
        experience = experience + v_xp_gain,
        turns = turns + v_turn_gain,
        last_resource_generation = v_last_regen + (v_minutes_passed * interval '1 minute')
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;


-- 4. Update upgrade_library
CREATE OR REPLACE FUNCTION public.upgrade_library()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats RECORD;
    v_current_level int;
    v_cost bigint;
    v_next_level_exists boolean;
    v_result json;
    v_use_vault boolean;
    v_gold bigint;
    v_vault bigint;
    v_total_gold bigint;
BEGIN
    v_user_id := auth.uid();
    
    -- Get stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    IF v_stats IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
    
    v_current_level := COALESCE(v_stats.library_level, 1);
    
    -- Get cost from table
    SELECT upgrade_cost INTO v_cost 
    FROM public.library_levels 
    WHERE level = v_current_level;
    
    IF v_cost IS NULL OR v_cost = 0 THEN
        RAISE EXCEPTION 'Max level reached or configuration missing';
    END IF;
    
    -- Check if next level exists in config (to avoid upgrading past config)
    PERFORM 1 FROM public.library_levels WHERE level = v_current_level + 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'This is the maximum level defined in the game.';
    END IF;
    
    -- Resource check
    v_use_vault := COALESCE(v_stats.use_vault_gold, false);
    v_gold := COALESCE(v_stats.gold, 0);
    v_vault := COALESCE(v_stats.vault, 0);
    
    IF v_use_vault THEN
        v_total_gold := v_gold + v_vault;
    ELSE
        v_total_gold := v_gold;
    END IF;
    
    IF v_total_gold < v_cost THEN
        RAISE EXCEPTION 'Insufficient gold';
    END IF;
    
    -- Deduct
    IF v_use_vault THEN
        IF v_gold >= v_cost THEN
            v_gold := v_gold - v_cost;
        ELSE
            DECLARE v_remainder bigint;
            BEGIN
                v_remainder := v_cost - v_gold;
                v_gold := 0;
                v_vault := v_vault - v_remainder;
            END;
        END IF;
    ELSE
        v_gold := v_gold - v_cost;
    END IF;
    
    -- Update
    UPDATE public.user_stats
    SET 
        library_level = v_current_level + 1,
        gold = v_gold,
        vault = v_vault
    WHERE id = v_user_id;
    
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;

-- 5. Admin Config Functions
CREATE OR REPLACE FUNCTION public.get_library_config()
RETURNS SETOF public.library_levels
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.library_levels ORDER BY level ASC;
$$;

CREATE OR REPLACE FUNCTION public.update_library_config(
    p_level int,
    p_upgrade_cost bigint,
    p_xp_rate int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.library_levels
    SET upgrade_cost = p_upgrade_cost, xp_rate = p_xp_rate
    WHERE level = p_level;
    
    IF NOT FOUND THEN
        INSERT INTO public.library_levels (level, upgrade_cost, xp_rate)
        VALUES (p_level, p_upgrade_cost, p_xp_rate);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_library_level(p_level int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.library_levels WHERE level = p_level;
END;
$$;
