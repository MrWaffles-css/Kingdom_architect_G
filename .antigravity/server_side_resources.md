# Server-Side Resource Generation System

## ✅ **SYSTEM NOW ACTIVE**

Your game now has **server-side resource generation** running every minute via PostgreSQL's `pg_cron` extension.

### **Cron Job Status**
- **Job ID**: 6
- **Name**: `process_game_tick`
- **Schedule**: `* * * * *` (every minute)
- **Command**: `SELECT public.process_game_tick()`
- **Status**: ✅ **ACTIVE**

---

## Why This Is Critical for Multiplayer

### **The Problem (Before)**
- Resources only generated when players were online
- If you were offline, your gold/resources were frozen
- Other players spying on you would see **outdated** resources
- Battles showed **incorrect** gold amounts
- Players could exploit this by staying offline

### **The Solution (Now)**
- ✅ **ALL players** get resources every minute, even when offline
- ✅ **Spy reports** show accurate, real-time resources
- ✅ **Battles** display correct gold amounts
- ✅ **Fair gameplay** - no offline exploitation
- ✅ **Consistent economy** - resources flow continuously

---

## How It Works

### **Server-Side (Every Minute)**
```
┌─────────────────────────────────────┐
│  PostgreSQL pg_cron                 │
│  Runs: * * * * * (every minute)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  process_game_tick()                │
│  - Loops through ALL players        │
│  - Calculates resources for each    │
│  - Updates database directly        │
│  - Uses dynamic configs             │
└─────────────────────────────────────┘
```

### **Client-Side (Catch-Up)**
```
┌─────────────────────────────────────┐
│  Player Opens Game                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  TimeContext.jsx                    │
│  - Detects minute boundaries        │
│  - Calls generate_resources()       │
│  - Catches up any missed minutes    │
└─────────────────────────────────────┘
```

### **Hybrid System Benefits**
1. **Server ensures consistency** - Resources update even when offline
2. **Client provides responsiveness** - Immediate feedback when online
3. **No double-dipping** - Both use `last_resource_generation` timestamp
4. **Multiplayer accuracy** - Other players always see correct data

---

## Resource Calculations

Every minute, **each player** receives:

### **Gold** 💰
```
= (citizens × 1) + (trained_soldiers × 0.5) + (miners × miner_rate)
```
- **Untrained Citizens**: 1 gold/minute each
- **Trained Soldiers**: 0.5 gold/minute each (attack, defense, spies, sentries)
- **Miners**: Based on `gold_mine_configs` table (dynamic)

### **Vault Interest** 🏦
```
= gold_gained × interest_rate (capped at vault capacity)
```
- Uses `calculate_vault_interest()` function
- Based on `vault_configs` table (admin-configurable)
- No interest if vault is over capacity

### **Experience** 📚
```
= xp_rate × minutes_passed
```
- Uses `library_levels` table
- XP rate increases with library level
- Admin-configurable via Admin Panel

### **Turns** ⚔️
```
= turns_per_minute × minutes_passed
```
- Uses `get_turns_per_minute()` function
- Based on research level
- Admin-configurable

### **Citizens** 👥
```
= citizens_per_minute × minutes_passed
```
- Uses `kingdom_configs` table
- Based on kingdom level
- Admin-configurable

---

## Multiplayer Scenarios

### **Scenario 1: Spying**
```
Player A (offline for 30 minutes)
├─ Server generates resources every minute
├─ Gold increases from 10,000 → 40,000
└─ Player B spies on Player A
    └─ Sees accurate 40,000 gold ✅
```

### **Scenario 2: Battle**
```
Player A (offline)
├─ Server keeps resources updated
└─ Player B attacks Player A
    ├─ Sees current gold amount
    └─ Steals correct percentage ✅
```

### **Scenario 3: Player Returns**
```
Player A (offline for 2 hours)
├─ Server generated resources every minute (120 minutes)
├─ Player A opens game
├─ Client calls generate_resources()
│   └─ Sees last_resource_generation is up-to-date
└─ No catch-up needed, already processed ✅
```

---

## Monitoring & Verification

### **Check Cron Job Status**
```sql
SELECT jobid, jobname, schedule, command, active 
FROM cron.job 
WHERE jobname = 'process_game_tick';
```

### **View Cron Job History**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = 6 
ORDER BY start_time DESC 
LIMIT 10;
```

### **Manual Trigger (Testing)**
```sql
SELECT public.process_game_tick();
```

### **Check Last Generation Time**
```sql
SELECT id, username, last_resource_generation, updated_at, gold, vault, turns
FROM user_stats us
JOIN profiles p ON us.id = p.id
ORDER BY last_resource_generation DESC;
```

---

## Performance Considerations

### **Current Implementation**
- Loops through each player individually
- Processes resources based on time elapsed
- Only updates if ≥1 minute has passed
- Uses dynamic config lookups with fallbacks

### **Optimization (If Needed)**
If you have 1000+ players, consider:
1. **Batch processing** - Update in chunks
2. **Set-based updates** - Single UPDATE statement
3. **Indexing** - Ensure `last_resource_generation` is indexed
4. **Monitoring** - Track execution time in `cron.job_run_details`

---

## Troubleshooting

### **Resources Not Updating?**
1. Check cron job is active: `SELECT * FROM cron.job WHERE jobname = 'process_game_tick'`
2. Check for errors: `SELECT * FROM cron.job_run_details WHERE jobid = 6 ORDER BY start_time DESC LIMIT 5`
3. Manually trigger: `SELECT public.process_game_tick()`

### **Double Resources?**
- Both server and client use `last_resource_generation` timestamp
- This prevents double-dipping
- If you see doubles, check for race conditions

### **Spy Reports Show Wrong Data?**
- Ensure spy report queries use current `user_stats` data
- Server updates happen every minute
- Data should always be fresh (within 1 minute)

---

## Summary

✅ **Server-side cron job** runs every minute  
✅ **All players** get resources even when offline  
✅ **Multiplayer accuracy** - spy reports show real data  
✅ **Dynamic configuration** - uses admin-configurable values  
✅ **Hybrid system** - server consistency + client responsiveness  
✅ **No exploitation** - fair gameplay for all  

Your game is now a **true multiplayer experience**! 🎮🚀
