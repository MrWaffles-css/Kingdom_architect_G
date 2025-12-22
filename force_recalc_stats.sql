-- Force recalculate your stats
-- Run this after updating the multiplier function

SELECT recalculate_user_stats(auth.uid());

-- Then check your current stats
SELECT 
    research_spy,
    spy,
    spies
FROM user_stats 
WHERE id = auth.uid();
