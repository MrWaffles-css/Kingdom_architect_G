-- RPC to get passive stats based on spy technology level
-- This function returns different levels of information based on the viewer's research_spy_report level

CREATE OR REPLACE FUNCTION get_passive_stats(target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_my_stats record;
    v_target_stats record;
    v_my_spy_level int;
    v_result json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get my stats and spy report level
    SELECT *, research_spy_report INTO v_my_stats 
    FROM user_stats 
    WHERE id = v_user_id;
    
    -- Get target stats
    SELECT * INTO v_target_stats FROM user_stats WHERE id = target_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Target not found');
    END IF;

    -- Check if my Spy > Target Sentry (deterministic, no variance for passive)
    IF (v_my_stats.spy <= v_target_stats.sentry) AND (v_user_id != target_id) THEN
        -- Check admin override
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND is_admin = true) THEN
            RETURN json_build_object('success', false, 'message', 'Insufficient spy network');
        END IF;
    END IF;
    
    v_my_spy_level := COALESCE(v_my_stats.research_spy_report, 0);
    
    -- If viewing own profile, grant max level
    IF v_user_id = target_id THEN
        v_my_spy_level := 5;
    END IF;
    
    -- Build response based on spy level
    v_result := json_build_object(
        'success', true,
        'spy_level', v_my_spy_level,
        -- Level 0+: Basic combat stats
        'gold', v_target_stats.gold,
        'turns', v_target_stats.turns,
        'experience', v_target_stats.experience,
        'attack', v_target_stats.attack,
        'defense', v_target_stats.defense,
        'spy', v_target_stats.spy,
        'sentry', v_target_stats.sentry
    );
    
    -- Level 1+: Citizens and unit counts
    IF v_my_spy_level >= 1 THEN
        v_result := v_result || json_build_object(
            'citizens', v_target_stats.citizens,
            'attack_soldiers', v_target_stats.attack_soldiers,
            'defense_soldiers', v_target_stats.defense_soldiers,
            'spies', v_target_stats.spies,
            'sentries', v_target_stats.sentries
        );
    END IF;
    
    -- Level 2+: Economy data
    IF v_my_spy_level >= 2 THEN
        v_result := v_result || json_build_object(
            'miners', v_target_stats.miners,
            'hostages', v_target_stats.hostages,
            'kingdom_level', v_target_stats.kingdom_level,
            'gold_mine_level', v_target_stats.gold_mine_level,
            'barracks_level', v_target_stats.barracks_level
        );
    END IF;
    
    -- Level 3+: Vault and Armoury
    IF v_my_spy_level >= 3 THEN
        v_result := v_result || json_build_object(
            'vault', v_target_stats.vault,
            'research_weapons', v_target_stats.research_weapons
        );
    END IF;
    
    -- Level 4+: Technology
    IF v_my_spy_level >= 4 THEN
        v_result := v_result || json_build_object(
            'library_level', v_target_stats.library_level,
            'research_attack', v_target_stats.research_attack,
            'research_defense', v_target_stats.research_defense,
            'research_spy', v_target_stats.research_spy,
            'research_sentry', v_target_stats.research_sentry,
            'research_turns_per_min', v_target_stats.research_turns_per_min,
            'research_hostage_convert', v_target_stats.research_hostage_convert
        );
    END IF;
    
    -- Level 5+: Full visibility including vault level
    IF v_my_spy_level >= 5 THEN
        v_result := v_result || json_build_object(
            'vault_level', v_target_stats.vault_level
        );
    END IF;
    
    RETURN v_result;
END;
$$;
