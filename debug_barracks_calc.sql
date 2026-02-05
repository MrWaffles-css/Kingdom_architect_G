CREATE OR REPLACE FUNCTION debug_barracks_calc(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_barracks_level INTEGER;
    v_config jsonb;
    v_level_config jsonb;
    v_base_strength INTEGER;
    v_found_config BOOLEAN;
BEGIN
    -- Get Barracks Level
    SELECT COALESCE(barracks_level, 1) INTO v_barracks_level
    FROM user_stats
    WHERE id = p_user_id;

    -- Get Config
    SELECT levels INTO v_config FROM barracks_configs LIMIT 1;
    
    v_found_config := (v_config IS NOT NULL);
    
    IF v_config IS NOT NULL THEN
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = v_barracks_level;
        
        IF v_level_config IS NOT NULL THEN
             v_base_strength := (v_level_config->>'stats_per_unit')::int;
        ELSE
             v_base_strength := -1; -- Config found but level missing
        END IF;
    ELSE
        v_base_strength := -2; -- No config table/row found
    END IF;

    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'barracks_level', v_barracks_level,
        'has_config', v_found_config,
        'level_config', v_level_config,
        'calculated_base_strength', v_base_strength,
        'raw_config_sample', CASE WHEN v_config IS NOT NULL THEN jsonb_path_query_array(v_config, '$[0 to 2]') ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
