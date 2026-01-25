-- MASSIVE FIX FOR SPY SYSTEM AND BATTLE LIST
-- This script addresses "Target not found" errors, duplicate users, and robustness.

-- 1. CLEANUP DUPLICATE CLIPPYS
-- Keep the one with the most Turns/Gold, or the oldest one.
DO $$
DECLARE
    v_keep_id uuid;
BEGIN
    -- Find the "Best" Clippy (Most Turns + Gold)
    SELECT us.id INTO v_keep_id 
    FROM public.user_stats us
    JOIN public.profiles p ON us.id = p.id
    WHERE p.username ILIKE 'Clippy'
    ORDER BY (us.turns + us.gold) DESC, p.created_at ASC
    LIMIT 1;

    IF v_keep_id IS NOT NULL THEN
        RAISE NOTICE 'Keeping Clippy ID: %', v_keep_id;
        
        -- Delete other Clippys from user_stats first (FK)
        DELETE FROM public.user_stats 
        WHERE id IN (SELECT id FROM public.profiles WHERE username ILIKE 'Clippy')
        AND id != v_keep_id;

        -- Delete other Clippys from profiles
        DELETE FROM public.profiles 
        WHERE username ILIKE 'Clippy'
        AND id != v_keep_id;
        
        RAISE NOTICE 'Deleted duplicate Clippys.';
    END IF;
END $$;


-- 2. REWRITE spy_player TO BE SELF-HEALING
CREATE OR REPLACE FUNCTION public.spy_player(target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
    v_defender_exists boolean;
BEGIN
    v_attacker_id := auth.uid();

    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot spy on yourself';
    END IF;

    -- Get Attacker Stats
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Your spy network is offline (Missing attacker stats).';
    END IF;

    -- SELF-HEALING: Check if target exists in STATS
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    
    IF NOT FOUND THEN
        -- Check if they exist in PROFILES at least
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_id) INTO v_defender_exists;
        
        IF v_defender_exists THEN
            RAISE NOTICE 'Target exists in Profiles but missing Stats. Auto-repairing...';
            -- Create default stats for them on the fly
            INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
            VALUES (target_id, 0, 600, 0, 0, 1, 2, 0)
            RETURNING * INTO v_defender_stats;
        ELSE
            RAISE EXCEPTION 'Target not found (ID does not exist)';
        END IF;
    END IF;

    -- Spy Logic
    -- Simple check: if Spy > Sentry (with variance), Success.
    IF (v_attacker_stats.spy * (0.8 + random() * 0.4)) > (v_defender_stats.sentry * (0.8 + random() * 0.4)) THEN
        -- SUCCESS: Insert Report
        INSERT INTO public.spy_reports (
            attacker_id, defender_id, 
            gold, vault, citizens, land,
            attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries, miners,
            kingdom_level, gold_mine_level, barracks_level, vault_level, library_level,
            research_weapons, research_attack, research_defense, research_spy, research_sentry, research_turns_per_min,
            hostages, research_hostage_convert
        ) VALUES (
            v_attacker_id, target_id,
            v_defender_stats.gold, v_defender_stats.vault, v_defender_stats.citizens, v_defender_stats.land,
            v_defender_stats.attack, v_defender_stats.defense, v_defender_stats.spy, v_defender_stats.sentry,
            v_defender_stats.attack_soldiers, v_defender_stats.defense_soldiers, v_defender_stats.spies, v_defender_stats.sentries, v_defender_stats.miners,
            v_defender_stats.kingdom_level, v_defender_stats.gold_mine_level, v_defender_stats.barracks_level, v_defender_stats.vault_level, v_defender_stats.library_level,
            v_defender_stats.research_weapons, v_defender_stats.research_attack, v_defender_stats.research_defense, v_defender_stats.research_spy, v_defender_stats.research_sentry, v_defender_stats.research_turns_per_min,
            v_defender_stats.hostages, v_defender_stats.research_hostage_convert
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'Spy report generated successfully.',
            'data', json_build_object(
                'gold', v_defender_stats.gold,
                'vault', v_defender_stats.vault,
                'citizens', v_defender_stats.citizens,
                'land', v_defender_stats.land,
                'attack', v_defender_stats.attack,
                'defense', v_defender_stats.defense,
                'spy', v_defender_stats.spy,
                'sentry', v_defender_stats.sentry,
                'attack_soldiers', v_defender_stats.attack_soldiers,
                'defense_soldiers', v_defender_stats.defense_soldiers,
                'spies', v_defender_stats.spies,
                'sentries', v_defender_stats.sentries,
                'miners', v_defender_stats.miners,
                'hostages', v_defender_stats.hostages,
                'kingdom_level', v_defender_stats.kingdom_level,
                'gold_mine_level', v_defender_stats.gold_mine_level,
                'barracks_level', v_defender_stats.barracks_level,
                'vault_level', v_defender_stats.vault_level,
                'library_level', v_defender_stats.library_level,
                'research_weapons', v_defender_stats.research_weapons,
                'research_attack', v_defender_stats.research_attack,
                'research_defense', v_defender_stats.research_defense,
                'research_spy', v_defender_stats.research_spy,
                'research_sentry', v_defender_stats.research_sentry,
                'research_turns_per_min', v_defender_stats.research_turns_per_min,
                'research_hostage_convert', v_defender_stats.research_hostage_convert
            )
        );
    ELSE
        -- FAILURE
        RETURN json_build_object('success', false, 'message', 'Spy mission failed! Their sentries detected your agents.');
    END IF;
END;
$$;

-- 3. ENSURE get_battle_opponents EXISTS AND IS CORRECT
DROP FUNCTION IF EXISTS public.get_battle_opponents(integer, integer);

CREATE OR REPLACE FUNCTION public.get_battle_opponents(p_page int, p_limit int)
RETURNS TABLE (
    id uuid,
    username text,
    alliance text,
    gold bigint,
    overall_rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.username,
        us.alliance,
        us.gold,
        l.overall_rank
    FROM public.leaderboard l
    LEFT JOIN public.user_stats us ON l.id = us.id
    ORDER BY l.overall_rank ASC
    LIMIT p_limit
    OFFSET p_page * p_limit;
END;
$$;
