-- Diagnostic: Check if functions exist
-- Run this to verify the functions were created

SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE '%research%attack%'
ORDER BY routine_name;

-- Also check permissions
SELECT 
    grantee,
    privilege_type,
    routine_name
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
    AND routine_name = 'upgrade_research_attack';
