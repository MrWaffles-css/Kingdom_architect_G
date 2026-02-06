-- Vault Configuration System
-- Allows admins to configure vault levels, upgrade costs, capacity, and interest rates

-- 1. Create vault_configs table
CREATE TABLE IF NOT EXISTS public.vault_configs (
    id SERIAL PRIMARY KEY,
    levels JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Populate with default configuration (10 levels, matching current system)
DO $$
DECLARE
    v_levels jsonb := '[]'::jsonb;
    i int;
BEGIN
    FOR i IN 1..10 LOOP
        v_levels := v_levels || jsonb_build_object(
            'level', i,
            'upgrade_cost', CASE i
                WHEN 1 THEN 5000
                WHEN 2 THEN 100000
                WHEN 3 THEN 1000000
                WHEN 4 THEN 4000000
                WHEN 5 THEN 8000000
                WHEN 6 THEN 20000000
                WHEN 7 THEN 75000000
                WHEN 8 THEN 200000000
                WHEN 9 THEN 1000000000
                WHEN 10 THEN 5000000000
                ELSE 0
            END,
            'capacity', CASE i
                WHEN 1 THEN 200000
                WHEN 2 THEN 300000
                WHEN 3 THEN 1500000
                WHEN 4 THEN 5000000
                WHEN 5 THEN 15000000
                WHEN 6 THEN 50000000
                WHEN 7 THEN 150000000
                WHEN 8 THEN 500000000
                WHEN 9 THEN 1500000000
                WHEN 10 THEN 5000000000
                ELSE 0
            END,
            'interest_rate', LEAST(50, i * 5)  -- 5%, 10%, 15%... capped at 50%
        );
    END LOOP;

    IF EXISTS (SELECT 1 FROM vault_configs) THEN
        UPDATE vault_configs 
        SET levels = v_levels, 
            updated_at = NOW()
        WHERE TRUE;
    ELSE
        INSERT INTO vault_configs (levels) 
        VALUES (v_levels);
    END IF;
END $$;

-- 3. Create function to get vault config
CREATE OR REPLACE FUNCTION get_vault_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT to_jsonb(c) 
        FROM (
            SELECT levels, updated_at 
            FROM vault_configs 
            LIMIT 1
        ) c
    );
END;
$$;

-- 4. Create function to update vault config (admin only)
CREATE OR REPLACE FUNCTION update_vault_config(
    p_levels jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_row_count INTEGER;
BEGIN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    
    -- Check if a config row exists
    SELECT COUNT(*) INTO v_row_count FROM vault_configs;
    
    IF v_row_count > 0 THEN
        -- Update the first (and should be only) row
        UPDATE vault_configs
        SET levels = p_levels,
            updated_at = NOW()
        WHERE id = (SELECT id FROM vault_configs LIMIT 1);
    ELSE
        -- Insert new row if none exists
        INSERT INTO vault_configs (levels) 
        VALUES (p_levels);
    END IF;
END;
$$;

-- 5. Update calculate_vault_capacity to use dynamic config
CREATE OR REPLACE FUNCTION public.calculate_vault_capacity(p_level int)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_config jsonb;
    v_level_config jsonb;
BEGIN
    IF p_level = 0 THEN RETURN 0; END IF;

    -- Get configuration
    SELECT levels INTO v_config FROM vault_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback to hardcoded values
        IF p_level = 1 THEN RETURN 200000;
        ELSIF p_level = 2 THEN RETURN 300000;
        ELSIF p_level = 3 THEN RETURN 1500000;
        ELSIF p_level = 4 THEN RETURN 5000000;
        ELSIF p_level = 5 THEN RETURN 15000000;
        ELSIF p_level = 6 THEN RETURN 50000000;
        ELSIF p_level = 7 THEN RETURN 150000000;
        ELSIF p_level = 8 THEN RETURN 500000000;
        ELSIF p_level = 9 THEN RETURN 1500000000;
        ELSIF p_level >= 10 THEN RETURN 5000000000;
        ELSE RETURN 0;
        END IF;
    ELSE
        -- Use dynamic configuration
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = p_level;
        
        IF v_level_config IS NULL THEN
            -- If level not found, return max capacity from config
            RETURN (
                SELECT MAX((item->>'capacity')::bigint)
                FROM jsonb_array_elements(v_config) item
            );
        END IF;
        
        RETURN (v_level_config->>'capacity')::bigint;
    END IF;
END;
$$;

-- 6. Update upgrade_vault to use dynamic config
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_gold bigint;
    v_vault_gold bigint;
    v_use_vault boolean;
    v_available_gold bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
    v_config jsonb;
    v_level_config jsonb;
    v_max_level int;
BEGIN
    -- Get current stats
    SELECT gold, vault, use_vault_gold, vault_level
    INTO v_current_gold, v_vault_gold, v_use_vault, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    v_current_level := COALESCE(v_current_level, 0);

    -- Get configuration
    SELECT levels INTO v_config FROM vault_configs LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Fallback to hardcoded values
        IF v_current_level >= 10 THEN
            RAISE EXCEPTION 'Max vault level reached';
        END IF;
        
        v_cost := CASE v_current_level
            WHEN 0 THEN 5000
            WHEN 1 THEN 100000
            WHEN 2 THEN 1000000
            WHEN 3 THEN 4000000
            WHEN 4 THEN 8000000
            WHEN 5 THEN 20000000
            WHEN 6 THEN 75000000
            WHEN 7 THEN 200000000
            WHEN 8 THEN 1000000000
            WHEN 9 THEN 5000000000
            ELSE 0
        END;
    ELSE
        -- Use dynamic configuration
        v_max_level := (
            SELECT MAX((item->>'level')::int)
            FROM jsonb_array_elements(v_config) item
        );
        
        IF v_current_level >= v_max_level THEN
            RAISE EXCEPTION 'Max vault level reached';
        END IF;
        
        -- Get cost for next level
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = v_current_level + 1;
        
        IF v_level_config IS NULL THEN
            RAISE EXCEPTION 'Configuration error: level % not found', v_current_level + 1;
        END IF;
        
        v_cost := (v_level_config->>'upgrade_cost')::bigint;
    END IF;

    -- Calculate available gold
    IF v_use_vault THEN
        v_available_gold := v_current_gold + v_vault_gold;
    ELSE
        v_available_gold := v_current_gold;
    END IF;

    -- Check if user has enough Gold
    IF v_available_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold (need %, have %)', v_cost, v_available_gold;
    END IF;
    
    -- Deduct Gold and upgrade vault
    IF v_use_vault THEN
        IF v_current_gold >= v_cost THEN
            UPDATE public.user_stats
            SET gold = gold - v_cost,
                vault_level = v_current_level + 1,
                updated_at = NOW()
            WHERE id = v_user_id;
        ELSE
            DECLARE
                v_remainder bigint;
            BEGIN
                v_remainder := v_cost - v_current_gold;
                UPDATE public.user_stats
                SET gold = 0,
                    vault = vault - v_remainder,
                    vault_level = v_current_level + 1,
                    updated_at = NOW()
                WHERE id = v_user_id;
            END;
        END IF;
    ELSE
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            vault_level = v_current_level + 1,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    PERFORM recalculate_user_stats(v_user_id);

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 7. Ensure game mechanic exists
INSERT INTO game_mechanics (key, enabled, description) 
VALUES ('vault_system', true, 'Vault building for storing gold and earning interest')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON vault_configs TO authenticated;
GRANT EXECUTE ON FUNCTION get_vault_config() TO authenticated;
GRANT EXECUTE ON FUNCTION update_vault_config(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION upgrade_vault() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_vault_capacity(int) TO authenticated;
