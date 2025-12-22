# Kingdom Architect G - Codebase Audit Report
**Date:** 2025-11-26
**Status:** Critical Issues Identified

## 1. 🚨 Critical Security & Privacy Issues

### A. Open Database Permissions (High Risk)
**Issue:** The current database setup grants `UPDATE` permissions on `public.user_stats` and `public.profiles` to the `authenticated` role.
**Risk:** Without strict Row Level Security (RLS) policies, **any logged-in user could technically modify another player's stats** (e.g., give themselves infinite gold or delete another user's army) by sending a custom API request.
**Recommendation:**
1.  Enable RLS on all tables (`ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;`).
2.  Create strict policies:
    *   Users can only `UPDATE` their own rows (`auth.uid() = id`).
    *   Admins can `UPDATE` all rows.

### B. Data Leakage via Leaderboard (Medium Risk)
**Issue:** The `public.leaderboard` view selects `*` from `user_stats`.
**Risk:** Any user can query this view to see **exact gold, troop counts, and vault contents** of any other player, bypassing the "Spy" mechanic.
**Recommendation:**
1.  Modify the `leaderboard` view to ONLY return `username`, `rank_score`, and public ranking metrics.
2.  Create a secure RPC function `get_spy_report(target_id)` that handles the logic for revealing sensitive data only when a spy mission succeeds.

---

## 2. 🏗️ Architecture & Code Quality

### A. Hardcoded Game Logic
**Issue:** Game rules are scattered.
*   `Kingdom.jsx` hardcodes gold generation: `(citizens) + (soldiers * 0.5)`.
*   `fix_turn_generation.sql` (Server) has its own calculation.
**Risk:** If you change the server logic, the UI will show incorrect values ("Drift").
**Recommendation:** Move all "Magic Numbers" (rates, costs, multipliers) into `src/gameConfig.js` and pass them to both the UI and (ideally) sync them with the backend, or have the backend send "rates" as part of the `user_stats` payload.

### B. Client-Side Validation
**Issue:** `Battle.jsx` checks `userStats.turns < 100` before allowing an attack.
**Risk:** A user could bypass this check.
**Recommendation:** Ensure the server-side `attack_player` RPC function also enforces this check (likely already done, but worth verifying).

---

## 3. 🎨 UX/UI Observations

### A. Missing Features (Placeholders)
The following areas are currently marked as "Under Construction":
*   **Alliance System**: `Alliance` page is a placeholder.
*   **World Map**: `Map` page is a placeholder.
*   **Army Management**: `Army` page is a placeholder (though `Barracks` exists).

### B. Feedback Loops
*   **Good:** The new `GameContext` provides excellent error handling for connection issues.
*   **Improvement:** The "Battle" log could be more persistent. Currently, attack results are shown in a modal and then lost.

---

## 4. ✅ Recent Improvements (Verified)
*   **State Management:** Successfully refactored to `GameContext`, solving the "Zero Stats" and "Stale Session" bugs.
*   **Resilience:** Added retry logic and "Fix Session" button.
*   **Resource Timer:** Fixed the resource generation timer to be independent of user actions.

## 5. Recommended Action Plan

1.  **Security Hardening (Priority 1):** Write and apply a `security_policies.sql` script to lock down RLS.
2.  **Privacy Fix (Priority 2):** Redefine `leaderboard` view to hide sensitive columns.
3.  **Config Unification (Priority 3):** Refactor `Kingdom.jsx` to use `gameConfig.js` for all calculations.
