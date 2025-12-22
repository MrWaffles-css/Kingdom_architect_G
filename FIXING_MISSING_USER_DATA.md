# Fixing Missing User Data (MrWaffles Issue)

## Problem
User data (like MrWaffles) is not showing up in the Supabase database or in the game UI.

## Root Causes
1. **Missing Profile Entry**: The user exists in `auth.users` but not in the `profiles` table
2. **Missing Stats Entry**: The user exists in `profiles` but not in `user_stats` table
3. **Missing Leaderboard View**: The `leaderboard` view doesn't exist or isn't properly joined
4. **Orphaned Records**: Data exists in one table but not the others

## Solution Steps

### Step 1: Diagnose the Issue
Run the diagnostic script to see what's missing:

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Open and run: `diagnose_mrwaffles.sql`
4. Review the results to see which tables are missing data

### Step 2: Apply the Fix
Run the comprehensive fix script:

1. In Supabase SQL Editor
2. Open and run: `fix_missing_user_data.sql`
3. This script will:
   - ✅ Create missing tables if they don't exist
   - ✅ Create profile entries for all auth users
   - ✅ Create user_stats entries for all profiles
   - ✅ Recreate the leaderboard view
   - ✅ Set up proper permissions
   - ✅ Create triggers for future users
   - ✅ Show verification results

### Step 3: Verify the Fix
After running the fix script, you should see:
- A verification table showing counts match across all tables
- A list of all users with their data

### Step 4: Refresh the Game
1. Go back to your browser with the game open
2. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
3. Log out and log back in if needed
4. Check the Battle page - you should now see players listed

## Common Issues & Solutions

### Issue: "MrWaffles still not showing"
**Solution**: The username might be different than expected. Check the diagnostic results to see the actual username stored in the database.

### Issue: "Stats are all zeros"
**Solution**: The user_stats entry exists but has default/zero values. You can either:
- Delete the user_stats row and let the game recreate it
- Use the Admin Panel to manually set values
- Run this SQL to reset a specific user:
```sql
UPDATE public.user_stats
SET 
    gold = 0,
    experience = 1000,
    turns = 100,
    citizens = 2,
    kingdom_level = 0
WHERE id = (SELECT id FROM public.profiles WHERE username = 'MrWaffles');
```

### Issue: "Leaderboard view error"
**Solution**: Make sure you've run all the prerequisite SQL files in order:
1. `add_serverside_resources.sql`
2. `add_weapon_system.sql`
3. `fix_missing_user_data.sql` (this file)

## Understanding the Database Structure

```
auth.users (Supabase Auth)
    ↓
public.profiles (Username, Admin Status)
    ↓
public.user_stats (Game Stats - Source of Truth)
    ↓
public.leaderboard (VIEW - Combines profiles + user_stats + rankings)
```

**Important**: 
- The `leaderboard` is a VIEW, not a table
- It automatically updates when `user_stats` changes
- It requires BOTH `profiles` and `user_stats` to exist for a user to appear

## Prevention
The fix script includes a trigger (`handle_new_user`) that automatically creates profile and user_stats entries for new users. This should prevent this issue from happening again.

## Still Having Issues?
If the problem persists:
1. Check the browser console for errors (F12)
2. Check Supabase logs for database errors
3. Verify your `.env` file has the correct Supabase credentials
4. Make sure you're logged in as the correct user
