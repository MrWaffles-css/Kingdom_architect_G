# Window Position & Size Persistence

## What Was Implemented

Added localStorage persistence for window positions and sizes across the entire game.

## Features

✅ **Persistent Window Positions**
- Windows remember where you placed them
- Each window (Kingdom, Barracks, Library, etc.) has its own saved position

✅ **Persistent Window Sizes**
- Windows remember their custom size if you resized them
- Resizing a window saves the new dimensions automatically

✅ **Survives Everything**
- Page refresh
- Logout/Login
- World reset
- Browser restart (as long as localStorage isn't cleared)

## How It Works

### Backend (localStorage)
- Window states are stored in `localStorage` under the key `'windowStates'`
- Format: `{ windowId: { position: { x, y }, size: { width, height } } }`
- Automatically saved when you finish dragging or resizing a window

### Frontend (Desktop.jsx)
1. On mount: Loads saved states from localStorage
2. When opening a window: Uses saved position/size if available
3. When moving/resizing: Updates localStorage automatically

## User Experience

**Before:**
- Windows always opened in default positions
- Had to rearrange windows every time you logged in
- Lost all window arrangements on page refresh

**After:**
- Windows open exactly where you left them
- Custom sizes are preserved
- Your workspace stays organized across sessions

## Technical Details

**Files Modified:**
- `src/components/Desktop.jsx` - Added localStorage load/save logic

**Storage Format:**
```json
{
  "kingdom": {
    "position": { "x": 100, "y": 150 },
    "size": { "width": 600, "height": 400 }
  },
  "barracks": {
    "position": { "x": 200, "y": 200 },
    "size": { "width": 650, "height": 500 }
  }
}
```

## Notes

- Each user has their own window layout (localStorage is per-browser)
- Clearing browser data will reset window positions
- Mobile users: Window positions are automatically adjusted to fit screen
