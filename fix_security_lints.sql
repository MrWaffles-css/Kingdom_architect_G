-- Fix Security Definer View
-- This changes the view to run with the permissions of the user invoking it (security_invoker=true),
-- ensuring RLS policies on underlying tables (like user_stats) are respected.
ALTER VIEW public.leaderboard SET (security_invoker = true);

-- Helper block to enable RLS and add standard Config policies (Public Read, Admin Write)
DO $$
DECLARE
    t text;
    config_tables text[] := ARRAY[
        'barracks_configs',
        'vault_stealing_configs',
        'vault_configs',
        'game_mechanics',
        'tech_stats_configs',
        'boss_configs',
        'turns_research_configs',
        'library_levels',
        'bosses',
        'kingdom_configs',
        'gold_mine_configs'
    ];
BEGIN
    FOREACH t IN ARRAY config_tables LOOP
        -- 1. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        -- 2. Add Read Policy (All authenticated/anon users can read config)
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'Enable read access for all users'
        ) THEN
            EXECUTE format('CREATE POLICY "Enable read access for all users" ON public.%I FOR SELECT TO public USING (true)', t);
        END IF;

        -- 3. Add Admin Write Policy (Only admins can insert/update/delete)
        -- Assuming 'profiles' table exists and has 'is_admin' column based on leaderboard view definition
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'Admins can perform all actions'
        ) THEN
            EXECUTE format('CREATE POLICY "Admins can perform all actions" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))', t);
        END IF;
    END LOOP;
END $$;

-- Fix user_boss_fights RLS
ALTER TABLE public.user_boss_fights ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Policy: Users can view their own boss fights
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_boss_fights' AND policyname = 'Service Role view all') THEN
       -- Creating a service role policy usually isn't strict RLS (service role bypasses), 
       -- but sometimes helpful to be explicit or if bypass is disabled. 
       -- Actually, let's just do standard user policies.
       NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_boss_fights' AND policyname = 'Users can view their own boss fights') THEN
        CREATE POLICY "Users can view their own boss fights" ON public.user_boss_fights FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_boss_fights' AND policyname = 'Users can insert their own boss fights') THEN
        CREATE POLICY "Users can insert their own boss fights" ON public.user_boss_fights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_boss_fights' AND policyname = 'Users can update their own boss fights') THEN
        CREATE POLICY "Users can update their own boss fights" ON public.user_boss_fights FOR UPDATE TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;
