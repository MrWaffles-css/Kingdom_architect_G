# Magnetic Window Snapping Feature

## Overview
Windows now have a magnetic snapping feature that makes them "snap together" like little magnets when dragged near each other or screen edges.

## How It Works

### Snap Distance
- **Threshold**: 15 pixels
- When a window edge comes within 15 pixels of another window edge or screen edge, it automatically snaps to align perfectly

### What It Snaps To
1. **Screen Edges**
   - Left edge of screen
   - Right edge of screen
   - Top edge of screen
   - Bottom edge of screen (accounting for taskbar)

2. **Other Window Edges**
   - Left and right edges (when windows overlap vertically)
   - Top and bottom edges (when windows overlap horizontally)

### Visual Feedback
- When a window snaps, it displays a **blue glow** (2px border) around it
- This glow disappears when you release the mouse/finish dragging
- Provides clear visual confirmation that snapping has occurred

### Technical Implementation

#### Files Modified
1. **Window.jsx**
   - Added `SNAP_THRESHOLD` constant (15px)
   - Added `isSnapped` state for visual feedback
   - Added `snapToNearestEdge()` function to calculate snap positions
   - Integrated snapping into the drag movement handler
   - Added blue glow effect when snapped

2. **Desktop.jsx**
   - Added `getAllWindowBounds()` function to collect positions of all open windows
   - Passes this function to each Window component via props
   - Added `data-window-id` attributes to all windows for identification

#### How Snapping is Calculated
1. When dragging, the window's current position is calculated
2. The position is checked against all screen edges
3. The position is checked against all other visible windows' edges
4. If within the 15px threshold, the position snaps to align perfectly
5. Visual feedback is shown with the blue glow

### User Experience
- **Smooth**: Snapping feels natural and magnetic
- **Non-invasive**: Only activates when within threshold distance
- **Helpful**: Makes it easy to align windows side-by-side or stack them neatly
- **Reversible**: Simply drag the window away to un-snap

### Benefits
- **Better Organization**: Easily create organized workspace layouts
- **Pixel-Perfect Alignment**: No more manually adjusting windows to line up
- **Screen Real Estate**: Maximize screen space by tiling windows perfectly
- **Productivity**: Faster window management workflow

## Examples of Use Cases
1. **Side-by-side comparison**: Snap two windows to fill left and right halves of screen
2. **Stacking**: Stack windows vertically for comparing data
3. **Grid layout**: Create a grid of windows for monitoring multiple sections
4. **Corner placement**: Quickly snap windows to screen corners

## Notes
- Snapping only works when windows are not maximized
- Snapping is disabled on mobile devices (windows are auto-maximized)
- The snapping calculation accounts for window sizes and screen boundaries
- Prevents windows from being dragged off-screen
