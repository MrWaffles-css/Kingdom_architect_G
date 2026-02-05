-- Fix for "UPDATE requires a WHERE clause" error in vault configuration
-- This migration was applied on 2026-02-05

-- The original update_vault_config function had an UPDATE statement without a WHERE clause
-- which is not allowed by PostgreSQL's security settings.

-- Fixed version includes:
-- 1. Check if config row exists
-- 2. If exists, UPDATE with WHERE clause targeting specific row
-- 3. If not exists, INSERT new row

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
