# Fixing Resource Generation Timer

## Problem
Currently, the game uses the `updated_at` timestamp to calculate when to give you resources (gold, turns, citizens). 
However, `updated_at` changes **every time you do anything** (buy weapons, train units, etc.).

This means if you take an action 50 seconds after your last turn, the timer resets to 0, and you lose that minute of progress. You effectively have to be inactive for a full minute to get resources!

## Solution
I've created a fix that adds a dedicated `last_resource_generation` timestamp that ONLY updates when you actually receive resources.

## Instructions

1. Open **Supabase SQL Editor**
2. Open and run the file: `fix_resource_timer.sql`
3. This script will:
   - ✅ Add the new `last_resource_generation` column
   - ✅ Initialize it for all existing users
   - ✅ Update the `generate_resources` logic to use this new column
   - ✅ Ensure you get credit for every full minute that passes, regardless of your actions

## Verification
After running the script:
1. Refresh your game
2. Note your current gold/turns
3. Perform some actions (buy something, train units)
4. Wait for the minute mark
5. You should receive your resources correctly even if you were active!
