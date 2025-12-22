# Security Hardening - Installation Guide

## 🛡️ What This Does
These scripts will:
1. **Lock down your database** - Users can only modify their own data
2. **Fix privacy leaks** - Leaderboard will no longer expose gold/troops

## 📋 Installation Steps

### Step 1: Run Security Policies
1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file `security_policies.sql`
4. Copy and paste the entire contents
5. Click **Run**
6. ✅ You should see verification output showing RLS is enabled

### Step 2: Secure the Leaderboard
1. In the same SQL Editor
2. Open the file `secure_leaderboard.sql`
3. Copy and paste the entire contents
4. Click **Run**
5. ✅ You should see a sample leaderboard WITHOUT gold/citizens columns

### Step 3: Test the Game
1. Refresh your game in the browser
2. Everything should work normally
3. Check the Battle page - you should still see the leaderboard
4. The leaderboard will now show ranks and combat stats, but NOT gold amounts

## ⚠️ Important Notes

### What Changed
- **Leaderboard**: No longer shows exact gold, citizens, or troop counts
- **Database**: Users can only update their own stats (prevents cheating)
- **Spy Mechanic**: Still works via the `spy_player` RPC function

### What Stays the Same
- All game functionality works normally
- Admins can still edit any user's data via the Admin Panel
- RPC functions (attack, spy, train, etc.) still work

## 🔍 Verification

After running both scripts, you can verify security by checking:
1. The verification queries at the end of each script will show you the current state
2. Try playing the game - everything should work
3. The Battle page leaderboard should show ranks but not exact gold

## 🚨 Troubleshooting

If you see errors about "permission denied":
- This is EXPECTED if you try to manually update another user's data
- The game's RPC functions will still work because they use `SECURITY DEFINER`

If the game stops working:
- Check the browser console (F12) for specific error messages
- Most likely cause: RPC functions need to be updated to use `SECURITY DEFINER`
