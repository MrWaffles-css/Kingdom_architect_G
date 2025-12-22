-- Add Vault Steal Research System
-- Run this in Supabase SQL Editor

-- 1. Add research column to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS research_vault_steal int DEFAULT 0;

-- 2. Function: Upgrade Vault Steal Research
CREATE OR REPLACE FUNCTION public.upgrade_research_vault_steal()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT experience, research_vault_steal INTO v_current_xp, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Handle null level (default to 0)
    IF v_current_level IS NULL THEN
        v_current_level := 0;
    END IF;

    -- Check Max Level
    IF v_current_level >= 5 THEN
        RAISE EXCEPTION 'Max research level reached';
    END IF;

    -- Calculate XP Cost for NEXT level
    -- Level 0 -> 1: 5,000 XP
    -- Level 1 -> 2: 10,000 XP
    -- Level 2 -> 3: 15,000 XP
    -- Level 3 -> 4: 20,000 XP
    -- Level 4 -> 5: 25,000 XP
    
    v_cost := 5000 * (v_current_level + 1);

    -- Validation
    IF v_current_xp < v_cost THEN
        RAISE EXCEPTION 'Not enough experience';
    END IF;

    -- Deduct XP & Upgrade
    UPDATE public.user_stats
    SET experience = experience - v_cost,
        research_vault_steal = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 3. Update Spy Player Function to include Vault Stealing
CREATE OR REPLACE FUNCTION spy_player(target_id UUID)
RETURNS JSONB AS $$
DECLARE
    my_spy BIGINT;
    their_sentry BIGINT;
    target_stats RECORD;
    my_research_level INTEGER;
    steal_percent NUMERIC;
    stolen_amount BIGINT := 0;
    result JSONB;
BEGIN
    -- Get my spy rating and research level
    SELECT spy, research_vault_steal INTO my_spy, my_research_level 
    FROM user_stats 
    WHERE id = auth.uid();
    
    -- Default research level if null
    IF my_research_level IS NULL THEN
        my_research_level := 0;
    END IF;
    
    -- Get target's sentry and stats
    SELECT * INTO target_stats FROM user_stats WHERE id = target_id;
    their_sentry := target_stats.sentry;
    
    -- Check if spy mission succeeds
    IF my_spy > their_sentry THEN
        
        -- Calculate Vault Steal if research > 0
        IF my_research_level > 0 AND target_stats.vault > 0 THEN
            -- 5% per level
            steal_percent := my_research_level * 0.05;
            stolen_amount := FLOOR(target_stats.vault * steal_percent);
            
            -- Execute the steal
            IF stolen_amount > 0 THEN
                -- Deduct from target vault
                UPDATE user_stats
                SET vault = vault - stolen_amount
                WHERE id = target_id;
                
                -- Add to attacker's GOLD (not vault)
                UPDATE user_stats
                SET gold = gold + stolen_amount
                WHERE id = auth.uid();
            END IF;
        END IF;

        -- Success - return full intel and save report
        result := jsonb_build_object(
            'success', true,
            'stolen_vault_gold', stolen_amount,
            'data', jsonb_build_object(
                'gold', target_stats.gold,
                'citizens', target_stats.citizens,
                'attack', target_stats.attack,
                'defense', target_stats.defense,
                'spy', target_stats.spy,
                'sentry', target_stats.sentry,
                'attack_soldiers', target_stats.attack_soldiers,
                'defense_soldiers', target_stats.defense_soldiers,
                'spies', target_stats.spies,
                'sentries', target_stats.sentries,
                'vault', target_stats.vault - stolen_amount -- Show updated vault amount
            )
        );
        
        -- Save spy report to database
        INSERT INTO spy_reports (
            spy_user_id, target_user_id,
            gold, citizens, attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries,
            spied_at
        ) VALUES (
            auth.uid(), target_id,
            target_stats.gold, target_stats.citizens,
            target_stats.attack, target_stats.defense,
            target_stats.spy, target_stats.sentry,
            target_stats.attack_soldiers, target_stats.defense_soldiers,
            target_stats.spies, target_stats.sentries,
            NOW()
        )
        ON CONFLICT (spy_user_id, target_user_id)
        DO UPDATE SET
            gold = EXCLUDED.gold,
            citizens = EXCLUDED.citizens,
            attack = EXCLUDED.attack,
            defense = EXCLUDED.defense,
            spy = EXCLUDED.spy,
            sentry = EXCLUDED.sentry,
            attack_soldiers = EXCLUDED.attack_soldiers,
            defense_soldiers = EXCLUDED.defense_soldiers,
            spies = EXCLUDED.spies,
            sentries = EXCLUDED.sentries,
            spied_at = NOW();
        
        RETURN result;
    ELSE
        -- Failed - detected
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Your spies were detected! Their sentry rating is too high.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
