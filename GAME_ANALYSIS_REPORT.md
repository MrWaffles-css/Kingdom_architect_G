# Kingdom Architect G - Game Analysis & Optimization Report

## Executive Summary
The codebase is well-structured with a clear separation of concerns between frontend components and backend SQL logic. The use of Supabase RPCs for complex actions like `attack_player`, `spy_player`, and `train_units` is a strong design choice that enhances security and performance.

However, there are critical areas where logic still resides on the frontend, creating security vulnerabilities (cheating) and maintenance risks. Additionally, the resource generation "catch-up" mechanic has a flaw that prevents offline progress from being realized immediately upon login.

## 1. Critical Issues (High Priority)

### 1.1. Resource Generation "Catch-Up" Flaw
**Current Behavior:**
The `generate_resources` RPC calculates resources based on the time elapsed since the last update. However, this function is **only called by the client's 60-second timer** in `App.jsx`.
*   **The Problem:** If a player logs out and returns 24 hours later, their stats are fetched (`fetchStats`), but `generate_resources` is NOT called until 60 seconds *after* they load the page.
*   **Consequence:** Players might see stale data for a minute, or worse, if they close the tab before 60s, they lose that offline progress calculation until the next session.
*   **Fix:** Call `generate_resources` immediately inside `fetchStats` (or right after login) to process any offline time instantly.

### 1.2. Kingdom Building & Upgrading is Client-Side
**Current Behavior:**
In `App.jsx`, `handleBuildKingdom` and `handleUpgradeKingdom` calculate costs and update the `user_stats` table directly using `supabase.from('user_stats').update(...)`.
*   **Risk:** A malicious user can bypass the cost check or set their kingdom level to 100 directly by calling the Supabase API with their own client.
*   **Fix:** Move this logic to a new RPC `upgrade_kingdom()` that handles cost validation and level increment server-side.

### 1.3. Turn Generation Mismatch
**Current Behavior:**
*   **Frontend (`Library.jsx`):** Displays `2 + turns_research` per minute.
*   **Backend (`add_serverside_resources.sql`):** Calculates `1 + turns_research` per minute.
*   **Fix:** Update the backend SQL to match the frontend promise (change `1 +` to `2 +`).

## 2. Performance & Efficiency

### 2.1. Consolidate Battle RPCs
**Current Behavior:**
After a successful attack in `Battle.jsx`, the client makes **three separate RPC calls**:
1.  `track_daily_attack`
2.  `track_daily_gold_stolen`
3.  `check_rank_achievements`
*   **Inefficiency:** This triples the network latency and database hits for every attack.
*   **Fix:** Call these tracking functions *inside* the `attack_player` SQL function. The client should only make one call: `attack_player`.

### 2.2. Duplicate Logic Maintenance
**Current Behavior:**
`Kingdom.jsx` manually calculates gold generation rates (e.g., `(2 + (level-1))`) to display "Gold/min". This duplicates the logic in `generate_resources`.
*   **Risk:** If you change the SQL formula, the frontend display will be wrong until you remember to update it manually.
*   **Fix:** Return the *current rates* as part of the `user_stats` or `generate_resources` response, or create a `get_rates` RPC so the frontend just displays what the backend reports.

## 3. Security & Validation

### 3.1. Client-Side Cost Validation
**Current Behavior:**
Components like `Barracks.jsx` calculate `maxTrainable` locally. While `train_units` does validate on the server, relying on client-side math for UI limits can lead to desyncs.
*   **Recommendation:** Ensure all "Buy" or "Train" actions rely 100% on the RPC's return value to update state, rather than optimistically updating local state (which `Barracks.jsx` currently does correctly by waiting for `onUpdate`).

## 4. Recommended Action Plan

### Phase 1: Security & Correctness (Immediate)
1.  [ ] **Create `upgrade_kingdom` RPC**: Move build/upgrade logic to SQL.
2.  [ ] **Fix Catch-Up**: Modify `App.jsx` to call `generate_resources` immediately on load.
3.  [ ] **Fix Turn Rate**: Update `add_serverside_resources.sql` to give `2 + research` turns.

### Phase 2: Optimization
4.  [ ] **Optimize Battle**: Move achievement tracking inside `attack_player`.
5.  [ ] **Refactor Rates**: Expose generation rates from the backend to clean up `Kingdom.jsx`.

### Phase 3: Future Proofing
6.  [ ] **Supabase Realtime**: Implement subscriptions so if you play on mobile, your desktop updates instantly.
