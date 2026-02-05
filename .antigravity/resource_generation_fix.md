# Resource Generation Timing Fix

## Problem
Turns were not always happening every minute, especially when players were away and came back. The resource generation was unreliable because:

1. **Narrow trigger window**: Resources only generated during a 1-second window each minute (`currentSecond === 1`)
2. **Browser throttling**: When tabs are inactive, browsers throttle timers, causing the 1-second window to be missed
3. **No recovery mechanism**: If the trigger was missed, resources wouldn't generate until the next minute
4. **No persistence**: The last generation time wasn't persisted, so page reloads could cause issues

## Solution
Implemented a robust multi-layered approach to ensure resource generation happens reliably:

### 1. **Minute-of-Day Tracking**
- Changed from checking `currentSecond === 1` to tracking the actual minute of the day (0-1439)
- Detects when we cross into a new minute, regardless of what second we're on
- More reliable and doesn't depend on hitting a narrow 1-second window

### 2. **localStorage Persistence**
- Stores the last generation minute in localStorage
- Survives page reloads and browser restarts
- Ensures we know when the last generation occurred even after navigation

### 3. **Safety Net Timer**
- Runs every 10 seconds to check if we missed a minute boundary
- Catches cases where the main 1-second timer was throttled or suspended
- Provides redundancy to ensure no minutes are missed

### 4. **Visibility Change Detection**
- Listens for when the tab becomes visible again
- Immediately checks if resources need to be generated when player returns
- Includes a 500ms delay to ensure the browser is fully active

### 5. **Centralized Trigger Function**
- All generation triggers go through a single `triggerGeneration()` function
- Logs the reason for each trigger (minute boundary, safety net, tab return)
- Makes debugging easier and ensures consistent behavior

## How It Works

```javascript
// 1. Track minute of day (0-1439)
const minuteOfDay = currentHour * 60 + currentMinute;

// 2. Compare with last generation
if (minuteOfDay !== lastMinuteOfDay) {
    // 3. Trigger generation and update tracking
    triggerGeneration('minute boundary');
    setLastGenerationMinute(minuteOfDay);
}
```

## Benefits
- ✅ Resources generate reliably every minute
- ✅ Works even when tab is throttled or suspended
- ✅ Catches up when player returns after being away
- ✅ Survives page reloads
- ✅ Better debugging with reason logging
- ✅ Multiple safety nets prevent missed generations

## Testing
To verify the fix works:
1. Play normally - resources should generate every minute
2. Switch to another tab for several minutes - resources should catch up when you return
3. Minimize the browser - resources should still generate
4. Reload the page - should continue from where you left off
5. Check console logs for generation triggers and their reasons
