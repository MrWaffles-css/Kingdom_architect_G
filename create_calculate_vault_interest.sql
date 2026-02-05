-- Create calculate_vault_interest function to use dynamic vault configuration
-- This function returns the interest rate (as a decimal) for a given vault level

CREATE OR REPLACE FUNCTION public.calculate_vault_interest(p_level int)
RETURNS numeric
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
        -- Fallback to hardcoded values (matching original system)
        IF p_level = 1 THEN RETURN 0.05;
        ELSIF p_level = 2 THEN RETURN 0.10;
        ELSIF p_level = 3 THEN RETURN 0.15;
        ELSIF p_level = 4 THEN RETURN 0.20;
        ELSIF p_level = 5 THEN RETURN 0.25;
        ELSIF p_level = 6 THEN RETURN 0.30;
        ELSIF p_level = 7 THEN RETURN 0.35;
        ELSIF p_level = 8 THEN RETURN 0.40;
        ELSIF p_level = 9 THEN RETURN 0.45;
        ELSIF p_level >= 10 THEN RETURN 0.50;
        ELSE RETURN 0;
        END IF;
    ELSE
        -- Use dynamic configuration
        SELECT item INTO v_level_config
        FROM jsonb_array_elements(v_config) item
        WHERE (item->>'level')::int = p_level;
        
        IF v_level_config IS NULL THEN
            -- If level not found, return max interest rate from config
            RETURN (
                SELECT MAX((item->>'interest_rate')::numeric) / 100.0
                FROM jsonb_array_elements(v_config) item
            );
        END IF;
        
        -- Convert percentage to decimal (e.g., 5 -> 0.05)
        RETURN (v_level_config->>'interest_rate')::numeric / 100.0;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_vault_interest(int) TO authenticated;

-- Add comment
COMMENT ON FUNCTION calculate_vault_interest(int) IS 'Returns the vault interest rate as a decimal (e.g., 0.05 for 5%) for a given vault level, using dynamic configuration from vault_configs table';
