-- =====================================================
-- TEST: Manually call generate_resources for Meg
-- =====================================================

-- First, get Meg's ID
DO $$
DECLARE
    v_meg_id uuid;
BEGIN
    SELECT id INTO v_meg_id FROM profiles WHERE username ILIKE '%meg%';
    
    RAISE NOTICE 'Meg ID: %', v_meg_id;
    
    -- Try to call generate_resources as Meg
    -- Note: This won't work perfectly because it needs auth.uid() context
    -- But it will help us see if there are any errors
    PERFORM generate_resources();
END $$;

-- Alternative: Check if there are any issues with Meg's last_resource_update
SELECT 
    username,
    last_resource_update,
    NOW() - last_resource_update as time_since_update,
    EXTRACT(EPOCH FROM (NOW() - last_resource_update)) as seconds_since_update
FROM user_stats us
JOIN profiles p ON us.id = p.id
WHERE p.username ILIKE '%meg%';
