import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { supabase } from '../supabase';
import DesktopIcon from './DesktopIcon';
import Taskbar from './Taskbar';
import Window from './Window';
import AdminPanel from './AdminPanel';
import ChatBubbles from './ChatBubbles';
import MobileTopBar from './MobileTopBar';
import Profile from './Profile';
import Clippy from './Clippy';
import GuideArrow from './GuideArrow';
// Profile is still needed for the "View Profile" window logic separately from the features list if referenced directly, 
// strictly speaking it's in the features list, but lines 515 use <Profile /> explicitly. 
// Actually, I should keep Profile import or use features.find... but keeping it is safer for now.
// Let's check line 515.
// Ah, line 515: <Profile ... />. So I DO need to keep Profile import unless I change that logic.
// The other components (Kingdom, etc) are only used via the features map.

import { desktopFeatures as features } from '../config/desktopFeatures';
import { getAvatarPath } from '../config/avatars';

const Desktop = ({
    stats,
    session,
    handleBuildKingdom,
    handleUpgradeKingdom,
    handleNavigate,
    handleLogout,
    handleViewProfile,
    setStats,
    refreshUserData,
    viewingUserId,
    setViewingUserId,
    showAdmin,
    setShowAdmin,
    isAdmin,
    profileUpdateTrigger // Added prop
}) => {
    const [openWindows, setOpenWindows] = useState(() => {
        try {
            const saved = localStorage.getItem('openWindowsPersistence');
            if (saved) {
                const parsed = JSON.parse(saved);
                // We need to re-read windowStates from local storage here since state isn't ready
                const savedStates = JSON.parse(localStorage.getItem('windowStates') || '{}');
                const isMobileInit = window.innerWidth < 768;

                return parsed.map((w, index) => {
                    const feature = features.find(f => f.id === w.id);
                    if (!feature) return null;

                    const savedState = savedStates[w.id];
                    const defaultStartY = isMobileInit ? 60 : 50;
                    // Fallback position if not saved, staggered
                    const initialPos = savedState?.position || { x: 50 + (index * 30), y: defaultStartY + (index * 30) };

                    return {
                        id: w.id,
                        title: feature.title,
                        icon: feature.isImage ? <img src={feature.icon} alt="" className="w-4 h-4" draggable="false" /> : feature.icon,
                        component: feature.component,
                        position: initialPos,
                        size: savedState?.size,
                        isMinimized: w.isMinimized || false,
                        defaultWidth: feature.defaultWidth || 400,
                        extraProps: w.extraProps || {}
                    };
                }).filter(Boolean);
            }
        } catch (e) {
            console.error('Failed to load open windows:', e);
        }
        return [];
    });

    // Persist open windows
    useEffect(() => {
        const windowsToSave = openWindows.map(w => ({
            id: w.id,
            extraProps: w.extraProps,
            isMinimized: w.isMinimized
        }));
        localStorage.setItem('openWindowsPersistence', JSON.stringify(windowsToSave));
    }, [openWindows]);
    const [activeWindowId, setActiveWindowId] = useState(null);
    const [startMenuOpen, setStartMenuOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState(null);
    const [unreadMailCount, setUnreadMailCount] = useState(0);
    const [viewingUserName, setViewingUserName] = useState(null);
    const [hasUnreadPatchNotes, setHasUnreadPatchNotes] = useState(false);
    const LATEST_PATCH_VERSION = '1.5';

    // Check for new patch notes
    useEffect(() => {
        const seenVersion = localStorage.getItem('seen_patch_version');
        if (seenVersion !== LATEST_PATCH_VERSION) {
            setHasUnreadPatchNotes(true);
        }
    }, []);

    const [adminMinimized, setAdminMinimized] = useState(false);
    const [hotkeys, setHotkeys] = useState({});

    // Selection Box State
    const [selectionBox, setSelectionBox] = useState(null);

    const getSelectionBoxStyle = () => {
        if (!selectionBox) return {};
        const left = Math.min(selectionBox.startX, selectionBox.currentX);
        const top = Math.min(selectionBox.startY, selectionBox.currentY);
        const width = Math.abs(selectionBox.currentX - selectionBox.startX);
        const height = Math.abs(selectionBox.currentY - selectionBox.startY);
        return {
            left, top, width, height,
            position: 'absolute',
            backgroundColor: 'rgba(0, 120, 215, 0.3)',
            border: '1px solid rgba(0, 120, 215, 0.7)',
            pointerEvents: 'none',
            zIndex: 999
        };
    };

    // Handle Desktop Mouse Down (for Selection Box)
    const handleDesktopMouseDown = (e) => {
        // Only start selection if clicking directly on the desktop or the overlay
        if (e.target === e.currentTarget || e.target.classList.contains('crt-overlay')) {
            setSelectionBox({
                startX: e.clientX,
                startY: e.clientY,
                currentX: e.clientX,
                currentY: e.clientY,
            });
        }
    };

    useEffect(() => {
        const fetchHotkeys = async () => {
            if (session?.user?.id) {
                const { data } = await supabase
                    .from('profiles')
                    .select('hotkeys')
                    .eq('id', session.user.id)
                    .single();
                if (data?.hotkeys) {
                    setHotkeys(data.hotkeys);
                }
            }
        };
        fetchHotkeys();
    }, [session]);

    // Re-fetch hotkeys when Control Panel updates them
    const refreshHotkeys = async () => {
        if (session?.user?.id) {
            const { data } = await supabase
                .from('profiles')
                .select('hotkeys')
                .eq('id', session.user.id)
                .single();
            if (data?.hotkeys) {
                setHotkeys(data.hotkeys);
            }
        }
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Ignore if typing in input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();
            // Find feature ID for this key
            const featureId = Object.keys(hotkeys).find(k => hotkeys[k] === key);

            if (featureId) {
                e.preventDefault();

                const existingWindow = openWindows.find(w => w.id === featureId);
                // Check if it's the top-most active window
                if (existingWindow && activeWindowId === featureId && !existingWindow.isMinimized) {
                    closeWindow(featureId);
                } else {
                    openWindow(featureId);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [hotkeys, openWindows, activeWindowId]);

    // Handle Escape Key Global Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                // Priority 0: Start Menu
                if (startMenuOpen) {
                    setStartMenuOpen(false);
                    return;
                }

                // Priority 1: User Profile Modal
                if (viewingUserId) {
                    setViewingUserId(null);
                    setViewingUserName(null);
                    return;
                }

                // Priority 2: Admin Panel Modal
                if (showAdmin) {
                    setShowAdmin(false);
                    return;
                }

                // Priority 3: Active Window
                if (activeWindowId) {
                    closeWindow(activeWindowId);
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewingUserId, showAdmin, activeWindowId, openWindows, startMenuOpen]); // Dependencies ensure we have fresh state

    // Admin Shortcut (Ctrl + A)
    useEffect(() => {
        const handleAdminShortcut = (e) => {
            // Allow default Select All behavior in inputs
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
                return;
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                if (isAdmin) {
                    e.preventDefault();
                    setShowAdmin(prev => !prev);
                }
            }
        };

        window.addEventListener('keydown', handleAdminShortcut);
        return () => window.removeEventListener('keydown', handleAdminShortcut);
    }, [isAdmin, setShowAdmin]);

    const updateWindowTitle = (id, newTitle) => {
        setOpenWindows(prev => prev.map(w => w.id === id ? { ...w, title: newTitle } : w));
    };

    // Load saved window states from localStorage on mount
    const [savedWindowStates, setSavedWindowStates] = useState(() => {
        try {
            const saved = localStorage.getItem('windowStates');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Failed to load window states:', e);
            return {};
        }
    });

    // Desktop Icon Dragging
    const { desktopLayout, saveDesktopLayout, showNotification, rewardPopup } = useGame();
    const [dragState, setDragState] = useState(null);
    const [localLayout, setLocalLayout] = useState({});
    const dragMoved = React.useRef(false);

    useEffect(() => {
        if (desktopLayout) {
            setLocalLayout(desktopLayout);
        }
    }, [desktopLayout]);

    // Fetch unread mail count
    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchUnreadCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('message_recipients')
                    .select('*', { count: 'exact', head: true })
                    .eq('recipient_id', session.user.id)
                    .eq('is_read', false)
                    .eq('is_deleted', false);

                if (error) throw error;
                setUnreadMailCount(count || 0);
            } catch (err) {
                console.error('Error fetching unread mail count:', err);
            }
        };

        fetchUnreadCount();

        // Subscribe to changes
        const channel = supabase
            .channel('public:message_recipients')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'message_recipients',
                filter: `recipient_id=eq.${session.user.id}`
            }, () => {
                fetchUnreadCount();
            })
            .subscribe();

        // Polling fallback
        const interval = setInterval(fetchUnreadCount, 30000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    // Fetch unread reports count & Check for offline attacks
    const [unreadReportsCount, setUnreadReportsCount] = useState(0);
    const reportsCheckDone = React.useRef(false);

    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchUnreadReports = async () => {
            try {
                // Get total unread count
                const { count, error } = await supabase
                    .from('reports')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', session.user.id)
                    .eq('is_read', false);

                if (error) throw error;
                setUnreadReportsCount(count || 0);

                // Check for attacks while away (Only run once per session load)
                if (!reportsCheckDone.current && count > 0) {
                    reportsCheckDone.current = true;

                    const { data: attacks, error: attackError } = await supabase
                        .from('reports')
                        .select('id, data')
                        .eq('user_id', session.user.id)
                        .eq('is_read', false)
                        .eq('type', 'defend_loss'); // Only care about losses? Or defend_win too? Request says "attacks that occurred". Usually implies being attacked.

                    if (!attackError && attacks && attacks.length > 0) {
                        const totalStolen = attacks.reduce((acc, curr) => acc + (curr.data?.gold_lost || 0), 0);
                        const msg = `You were attacked ${attacks.length} times while away! Lost ${totalStolen.toLocaleString()} Gold. Check Reports!`;
                        showNotification(msg, 10000); // 10s duration
                    }
                }
            } catch (err) {
                console.error('Error fetching reports:', err);
            }
        };

        fetchUnreadReports();

        const channel = supabase
            .channel('public:reports')
            .on('postgres_changes', {
                event: 'INSERT', // Only listen for new inserts? Or updates too if read status changes?
                schema: 'public',
                table: 'reports',
                filter: `user_id=eq.${session.user.id}`
            }, () => {
                fetchUnreadReports();
                // If it's a new INSERT, we might want a toast too?
                // The polling handles the badge.
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'reports',
                filter: `user_id=eq.${session.user.id}`
            }, () => {
                // If read status changes
                fetchUnreadReports();
            })
            .subscribe();

        // Polling fallback
        const interval = setInterval(fetchUnreadReports, 30000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id, showNotification]);

    // Mobile detection
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getDefaultPosition = (index) => {
        // Column-major grid: 6 items per column
        const col = Math.floor(index / 6);
        const row = index % 6;

        // On mobile, shift everything down by 50px (40px bar + 10px margin)
        // Also maybe adjust grid to be tighter or different on mobile? 
        // For now, just shifting Y is enough to clear the bar.
        const startY = isMobile ? 60 : 20;

        return { x: 20 + col * 100, y: startY + row * 110 };
    };

    const handleIconDragStart = (e, id) => {
        e.stopPropagation();
        e.preventDefault();
        dragMoved.current = false;
        const index = features.findIndex(f => f.id === id);
        const currentPos = localLayout[id] || getDefaultPosition(index);

        setDragState({
            id,
            startX: e.clientX,
            startY: e.clientY,
            initialX: currentPos.x,
            initialY: currentPos.y
        });
    };

    const handleMouseMove = (e) => {
        if (dragState) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                dragMoved.current = true;
            }

            // Constrain Y to not go under the top bar on mobile
            let newY = dragState.initialY + dy;
            if (isMobile) {
                newY = Math.max(newY, 50);
            }
            newY = Math.max(newY, 0); // General constraint

            setLocalLayout(prev => ({
                ...prev,
                [dragState.id]: {
                    x: dragState.initialX + dx,
                    y: newY
                }
            }));
        } else if (selectionBox) {
            // Update selection box
            setSelectionBox(prev => ({
                ...prev,
                currentX: e.clientX,
                currentY: e.clientY
            }));
        }
    };

    const handleMouseUp = () => {
        if (dragState) {
            saveDesktopLayout(localLayout);
            setDragState(null);
        }
        if (selectionBox) {
            setSelectionBox(null);
        }
    };

    const openWindow = (featureId, extraProps = {}) => {
        if (featureId === 'patch') {
            setHasUnreadPatchNotes(false);
            localStorage.setItem('seen_patch_version', LATEST_PATCH_VERSION);
        }
        if (featureId === 'reports') {
            setUnreadReportsCount(0);
        }

        const existingWindow = openWindows.find(w => w.id === featureId);
        if (existingWindow) {
            if (existingWindow.isMinimized) {
                setOpenWindows(openWindows.map(w => w.id === featureId ? { ...w, isMinimized: false } : w));
            }
            if (extraProps) {
                setOpenWindows(openWindows.map(w => w.id === featureId ? { ...w, extraProps: { ...w.extraProps, ...extraProps } } : w));
            }
            setActiveWindowId(featureId);
            return;
        }

        const feature = features.find(f => f.id === featureId);

        // Check for saved state
        const savedState = savedWindowStates[featureId];
        // Ensure default window position also respects mobile bar
        const defaultStartY = isMobile ? 60 : 50;
        const initialPos = savedState?.position || { x: 50 + (openWindows.length * 30), y: defaultStartY + (openWindows.length * 30) };
        const initialSize = savedState?.size || null;

        const newWindow = {
            id: featureId,
            title: feature.title,
            icon: feature.isImage ? <img src={feature.icon} alt="" className="w-4 h-4" draggable="false" /> : feature.icon,
            component: feature.component,
            position: initialPos,
            size: initialSize,
            isMinimized: false,
            // duplicate keys removed
            defaultWidth: feature.defaultWidth || 400,
            extraProps: extraProps
        };

        setOpenWindows([...openWindows, newWindow]);
        setActiveWindowId(featureId);
    };

    const toggleMinimize = (id) => {
        setOpenWindows(openWindows.map(w => {
            if (w.id === id) {
                return { ...w, isMinimized: !w.isMinimized };
            }
            return w;
        }));

        // If we just minimized the active window, de-activate it
        if (activeWindowId === id) {
            setActiveWindowId(null);
        }
    };

    const closeWindow = (id) => {
        setOpenWindows(openWindows.filter(w => w.id !== id));
        if (activeWindowId === id) {
            setActiveWindowId(null);
        }
    };

    const handleWindowStateUpdate = (id, newState) => {
        setSavedWindowStates(prev => {
            const updated = {
                ...prev,
                [id]: { ...prev[id], ...newState }
            };
            // Persist to localStorage
            try {
                localStorage.setItem('windowStates', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save window states:', e);
            }
            return updated;
        });
    };

    // Get bounds of all windows for snapping
    const getAllWindowBounds = (excludeId) => {
        const bounds = [];

        openWindows.forEach(win => {
            if (win.id !== excludeId && !win.isMinimized) {
                const windowElement = document.querySelector(`[data-window-id="${win.id}"]`);
                if (windowElement) {
                    const rect = windowElement.getBoundingClientRect();
                    bounds.push({
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    });
                } else if (win.position && win.size) {
                    // Fallback to stored position/size if element not found
                    bounds.push({
                        x: win.position.x,
                        y: win.position.y,
                        width: win.size.width || win.defaultWidth || 400,
                        height: win.size.height || 300
                    });
                }
            }
        });

        return bounds;
    };

    const handleAutoArrange = () => {
        // Defined layout from user request
        const customLayout = [
            // Column 1
            { id: 'overview', col: 0, row: 0 },
            { id: 'profile', col: 0, row: 1 },
            { id: 'news', col: 0, row: 2 },
            { id: 'about', col: 0, row: 3 },
            { id: 'help', col: 0, row: 4 },
            { id: 'patch', col: 0, row: 5 },
            { id: 'mail', col: 0, row: 6 },
            { id: 'recycle', col: 0, row: 7 },

            // Column 2
            { id: 'vault', col: 1, row: 0 },
            { id: 'reports', col: 1, row: 1 },
            { id: 'barracks', col: 1, row: 2 },
            { id: 'armoury', col: 1, row: 3 },
            { id: 'library', col: 1, row: 4 },
            { id: 'stats', col: 1, row: 5 },
            { id: 'kingdom', col: 1, row: 6 },

            // Column 3
            { id: 'goldmine', col: 2, row: 0 },
            { id: 'battle', col: 2, row: 1 },
        ];

        const newLayout = {};
        customLayout.forEach(item => {
            // Check if feature exists (in case it was removed like 'games')
            if (features.some(f => f.id === item.id)) {
                const startY = isMobile ? 60 : 20;
                newLayout[item.id] = {
                    x: 20 + item.col * 100,
                    y: startY + item.row * 110
                };
            }
        });

        // Handle any remaining icons that weren't in the specific list (fallback)
        let fallbackCol = 3;
        let fallbackRow = 0;
        features.forEach(feature => {
            if (!newLayout[feature.id]) {
                const startY = isMobile ? 60 : 20;
                newLayout[feature.id] = {
                    x: 20 + fallbackCol * 100,
                    y: startY + fallbackRow * 110
                };
                fallbackRow++;
                if (fallbackRow > 6) {
                    fallbackRow = 0;
                    fallbackCol++;
                }
            }
        });

        setLocalLayout(newLayout);
        saveDesktopLayout(newLayout);
    };

    const lastRightClickTime = React.useRef(0);
    const handleContextMenu = (e) => {
        e.preventDefault(); // Prevent browser context menu
        const now = Date.now();
        if (now - lastRightClickTime.current < 400) {
            handleAutoArrange();
        }
        lastRightClickTime.current = now;
    };

    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

    return (
        <div
            className="w-full h-screen bg-[#008080] overflow-hidden relative font-sans text-sm select-none desktop-container"
            onClick={() => setStartMenuOpen(false)}
            onMouseDown={handleDesktopMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={(e) => {
                if (dragState) {
                    // Prevent scrolling while dragging an icon
                    e.preventDefault();
                    const touch = e.touches[0];
                    handleMouseMove({
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                }
            }}
            onTouchEnd={handleMouseUp}
            onContextMenu={handleContextMenu}
        >
            {/* Selection Box */}
            {selectionBox && <div style={getSelectionBoxStyle()} />}



            <MobileTopBar stats={stats} />

            {/* Desktop Icons */}
            {features.map((feature, index) => {
                const position = localLayout[feature.id] || getDefaultPosition(index);
                // Dynamically ensure Y is at least 60 (approx 50px safe) if on mobile
                const displayY = isMobile ? Math.max(position.y, 60) : position.y;

                if (feature.hidden) return null;

                let iconContent = feature.isImage ? <img src={feature.icon} alt={feature.title} className={`${feature.iconClassName || 'w-8 h-8'} pixelated`} draggable="false" /> : feature.icon;

                // Override for Profile if avatar exists
                if (feature.id === 'profile' && stats?.avatar_id) {
                    const avatarSrc = getAvatarPath(stats.avatar_id);
                    if (avatarSrc) {
                        // Use a larger, framed icon for the avatar
                        iconContent = (
                            <div className="w-12 h-12 relative flex items-center justify-center">
                                <img
                                    src={avatarSrc}
                                    alt="Profile"
                                    className="w-full h-full object-cover border-2 border-white shadow-sm pixelated bg-[#008080]"
                                    draggable="false"
                                />
                            </div>
                        );
                    }
                }

                return (
                    <React.Fragment key={feature.id}>
                        <DesktopIcon
                            label={feature.title}
                            icon={iconContent}
                            onClick={() => {
                                if (!dragMoved.current) {
                                    openWindow(feature.id);
                                }
                            }}
                            badge={
                                feature.id === 'mail' ? unreadMailCount :
                                    feature.id === 'reports' ? unreadReportsCount :
                                        (feature.id === 'patch' && hasUnreadPatchNotes ? 1 : 0)
                            }
                            className="absolute animate-stagger-appear"
                            style={{
                                left: position.x,
                                top: displayY,
                                animationDelay: `${index * 100}ms`
                            }}
                            onMouseDown={(e) => handleIconDragStart(e, feature.id)}
                            onTouchStart={(e) => {
                                const touch = e.touches[0];
                                // Normalize touch event to mimic mouse event structure for handleIconDragStart
                                handleIconDragStart({
                                    stopPropagation: () => e.stopPropagation(),
                                    preventDefault: () => { },
                                    clientX: touch.clientX,
                                    clientY: touch.clientY
                                }, feature.id);
                            }}
                        />

                    </React.Fragment>
                );
            })}

            {/* Render Windows */}
            {openWindows.map(win => {
                if (win.isMinimized) return null;

                const Component = win.component;
                // Prepare common props
                const props = {
                    userStats: stats, // For some components
                    stats: stats, // For Overview
                    session: session,
                    // Specific props for specific components (handling legacy prop names)
                    kingdomLevel: stats?.kingdom_level || 0,
                    citizens: stats?.citizens || 0,
                    experience: stats?.experience || 0,
                    onBuild: handleBuildKingdom,
                    onUpgrade: handleUpgradeKingdom,
                    onUpdate: (newData) => {
                        if (newData?.hotkeys) {
                            refreshHotkeys();
                        } else {
                            setStats(prev => ({ ...prev, ...newData }));
                        }
                        refreshUserData(session.user.id);
                    },
                    onNavigate: (page, data) => {
                        // Map old navigation strings to window IDs if possible
                        const mapping = {
                            'Overview': 'overview',
                            'Kingdom': 'kingdom',
                            'Barracks': 'barracks',
                            'Battle': 'battle',
                            'GoldMine': 'goldmine',
                            'Vault': 'vault',
                            'Library': 'library',
                            'Reports': 'reports',
                            'Mail': 'mail',
                            'Profile': 'profile',
                            'SpyReport': 'spy_report'
                        };
                        const targetId = mapping[page];
                        if (targetId) openWindow(targetId, data);
                    },
                    onAction: () => refreshUserData(session.user.id),
                    userId: session.user.id,
                    isOwnProfile: true,
                    onViewProfile: (targetId) => openWindow('profile', { userId: targetId, isOwnProfile: false, updateTrigger: Date.now() }),
                    onTitleChange: (newTitle) => updateWindowTitle(win.id, newTitle),
                    onClose: () => closeWindow(win.id),
                    ...win.extraProps
                };

                return (
                    <Window
                        key={win.id}
                        title={win.title}
                        isOpen={true}
                        onClose={() => closeWindow(win.id)}
                        onMinimize={() => toggleMinimize(win.id)}
                        isActive={activeWindowId === win.id}
                        onFocus={() => setActiveWindowId(win.id)}
                        initialPosition={win.position}
                        initialSize={win.size}
                        width={win.defaultWidth}
                        onStateUpdate={(newState) => handleWindowStateUpdate(win.id, newState)}
                        getAllWindowBounds={() => getAllWindowBounds(win.id)}
                        data-window-id={win.id}
                    >
                        <Component {...props} />
                    </Window>
                );
            })}

            {/* Special Windows (Modals -> Windows) */}
            {showAdmin && !adminMinimized && (
                <Window
                    title="Admin Panel"
                    isOpen={true}
                    onClose={() => setShowAdmin(false)}
                    onMinimize={() => setAdminMinimized(true)}
                    isActive={activeWindowId === 'admin'}
                    onFocus={() => setActiveWindowId('admin')}
                    width={600}
                    initialPosition={savedWindowStates['admin']?.position}
                    initialSize={savedWindowStates['admin']?.size}
                    onStateUpdate={(newState) => handleWindowStateUpdate('admin', newState)}
                    getAllWindowBounds={() => getAllWindowBounds('admin')}
                    data-window-id="admin"
                >
                    <AdminPanel
                        onClose={() => setShowAdmin(false)}
                        onUserUpdate={() => refreshUserData(session.user.id)}
                        onWorldReset={() => {
                            setStats({ gold: 0, experience: 600, turns: 0, vault: 0, rank: 1, citizens: 2, kingdom_level: 0, tutorial_step: 0 });
                            refreshUserData(session.user.id);
                        }}
                        initialTab={savedWindowStates['admin']?.tab}
                        onTabChange={(tab) => handleWindowStateUpdate('admin', { tab })}
                    />
                </Window>
            )}

            {viewingUserId && (
                <Window
                    title={viewingUserName || 'User Profile'}
                    isOpen={true}
                    onClose={() => { setViewingUserId(null); setViewingUserName(null); }}
                    onMinimize={() => { }}
                    isActive={true}
                    onFocus={() => { }}
                    width={700}
                    initialPosition={savedWindowStates['profile']?.position}
                    initialSize={savedWindowStates['profile']?.size}
                    onStateUpdate={(newState) => handleWindowStateUpdate('profile', newState)}
                    getAllWindowBounds={() => getAllWindowBounds('viewing-profile')}
                    data-window-id="viewing-profile"
                >
                    <Profile
                        userId={viewingUserId}
                        isOwnProfile={false}
                        session={session}
                        onNavigate={(page) => {
                            setViewingUserId(null);
                            setViewingUserName(null);
                            // ...
                        }}
                        onAction={() => refreshUserData(session.user.id)}
                        onTitleChange={(name) => setViewingUserName(name)}
                        updateTrigger={profileUpdateTrigger}
                    />
                </Window>
            )}


            {/* Start Menu */}
            {startMenuOpen && (
                <div className="absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] left-0 w-48 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 shadow-md flex flex-col z-50 animate-fade-in origin-bottom-left">
                    {/* Side Bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-b from-[#000080] to-[#1084d0] flex items-end justify-center pb-2">
                        <span className="text-white font-bold text-lg -rotate-90 whitespace-nowrap mb-6 origin-center">Kingdom</span>
                    </div>

                    <div className="pl-7 pr-1 py-1 space-y-1">
                        {/* Profile */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('profile'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2 group"
                            >
                                {stats?.avatar_id ? (
                                    <img src={getAvatarPath(stats.avatar_id)} alt="" className="w-6 h-6 object-cover border border-white pixelated bg-[#008080]" draggable="false" />
                                ) : (
                                    <img src="https://win98icons.alexmeub.com/icons/png/users-1.png" alt="" className="w-6 h-6" draggable="false" />
                                )}
                                <span className="text-sm">Profile</span>
                            </button>
                            {stats?.tutorial_step === 1 && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        <div className="h-px bg-gray-400 my-1 shadow-[0_1px_0_white]"></div>



                        {/* Kingdom */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('kingdom'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/kingdom_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Kingdom</span>
                            </button>
                            {stats?.tutorial_step === 3 && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Gold Mine */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('goldmine'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/goldmine_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Gold Mine</span>
                            </button>
                            {(stats?.tutorial_step === 4 || stats?.tutorial_step === 5) && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Library */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('library'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/library_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Library</span>
                            </button>
                            {stats?.tutorial_step === 6 && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Barracks */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('barracks'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/barracks_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Barracks</span>
                            </button>
                            {(stats?.tutorial_step === 8 || stats?.tutorial_step === 10) && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Battlefield */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('battle'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/battlefield_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Battlefield</span>
                            </button>
                            {(stats?.tutorial_step === 9 || stats?.tutorial_step === 12) && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Bosses */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('bosses'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/bosses_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Bosses</span>
                            </button>
                        </div>

                        {/* Vault */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('vault'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/vault_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Vault</span>
                            </button>
                            {stats?.tutorial_step === 14 && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Armoury */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('armoury'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/armoury_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Armoury</span>
                            </button>
                            {stats?.tutorial_step === 11 && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Reports */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('reports'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/reports_icon.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Reports</span>
                            </button>
                            {stats?.tutorial_step === 13 && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Submenu for Games */}
                        <div
                            className="relative"
                            onMouseEnter={() => setActiveSubmenu('games')}
                            onMouseLeave={() => setActiveSubmenu(null)}
                        >
                            <button className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2 justify-between group">
                                <div className="flex items-center gap-2">
                                    <img src="https://win98icons.alexmeub.com/icons/png/joystick-0.png" alt="" className="w-6 h-6" draggable="false" />
                                    <span className="text-sm">Games</span>
                                </div>
                                <span className="text-[10px] text-gray-800 group-hover:text-white">▶</span>
                            </button>

                            {/* Nested Menu */}
                            {activeSubmenu === 'games' && (
                                <div className="absolute left-full top-0 w-40 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 shadow-md">
                                    <button
                                        onClick={() => { openWindow('games', { initialGame: 'minesweeper' }); setActiveSubmenu(null); setStartMenuOpen(false); }}
                                        className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                                    >
                                        <img src="https://win98icons.alexmeub.com/icons/png/minesweeper-0.png" alt="" className="w-4 h-4" draggable="false" />
                                        <span className="text-sm">Minesweeper</span>
                                    </button>
                                    <button
                                        onClick={() => { openWindow('games', { initialGame: 'snake' }); setActiveSubmenu(null); setStartMenuOpen(false); }}
                                        className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                                    >
                                        <span className="text-sm ml-1">🐍</span>
                                        <span className="text-sm">Snake</span>
                                    </button>
                                </div>
                            )}
                        </div>



                        <div className="h-px bg-gray-400 my-1 shadow-[0_1px_0_white]"></div>

                        {isAdmin && (
                            <button
                                onClick={() => { setShowAdmin(true); setAdminMinimized(false); setActiveWindowId('admin'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="https://win98icons.alexmeub.com/icons/png/settings_gear-0.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Admin</span>
                            </button>
                        )}

                        <div className="h-px bg-gray-400 my-1 shadow-[0_1px_0_white]"></div>

                        {/* Logout */}
                        <div className="relative">
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="https://win98icons.alexmeub.com/icons/png/shut_down_with_computer-0.png" alt="" className="w-6 h-6" draggable="false" />
                                <span className="text-sm">Log Off</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Taskbar
                openWindows={[...openWindows, ...(showAdmin ? [{ id: 'admin', title: 'Admin Panel', icon: '🛠️', isMinimized: adminMinimized }] : [])]}
                activeWindowId={activeWindowId}
                onWindowClick={(id) => {
                    if (id === 'admin') {
                        if (adminMinimized) {
                            setAdminMinimized(false);
                            setActiveWindowId('admin');
                        } else if (activeWindowId === 'admin') {
                            setAdminMinimized(true);
                        } else {
                            setActiveWindowId('admin');
                        }
                        return;
                    }

                    const win = openWindows.find(w => w.id === id);
                    if (win) {
                        if (win.isMinimized) {
                            // If minimized, restore it
                            setOpenWindows(openWindows.map(w => w.id === id ? { ...w, isMinimized: false } : w));
                            setActiveWindowId(id);
                        } else if (activeWindowId === id) {
                            // If active, minimize it
                            toggleMinimize(id);
                        } else {
                            // If open but not active, make active
                            setActiveWindowId(id);
                        }
                    }
                }}
                onStartClick={(e) => { e.stopPropagation(); setStartMenuOpen(!startMenuOpen); }}
                stats={stats}
            />

            <ChatBubbles session={session} />

            {/* Clippy Tutorial */}
            <Clippy
                stats={stats}
                openWindows={openWindows}
                onNavigate={(id) => openWindow(id)}
                onAdvance={(updates) => {
                    if (updates) {
                        setStats(prev => ({ ...prev, ...updates }));
                    }
                    refreshUserData(session.user.id);
                }}
            />

            {/* Global Reward Popup (Rendered here to be top-level z-index) */}
            {rewardPopup && (() => {
                const durationStr = localStorage.getItem('boss_popup_duration');
                const duration = durationStr ? parseInt(durationStr, 10) : 3000;

                return (
                    <div
                        className="fixed bottom-12 right-4 z-[99999] animate-slide-up-down pointer-events-none"
                        style={{ animationDuration: `${duration}ms` }}
                    >
                        <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 shadow-2xl pointer-events-auto" style={{ minWidth: '320px', maxWidth: '400px' }}>
                            {/* Title Bar */}
                            <div className="px-2 py-1 bg-gradient-to-r from-[#000080] to-[#1084d0] text-white font-bold flex items-center gap-2">
                                <span className="text-sm">🏆 Victory Rewards!</span>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-3">
                                <div className="text-center mb-3">
                                    <div className="text-4xl mb-2">⚔️</div>
                                    <div className="text-sm font-bold text-gray-700">Boss Defeated!</div>
                                </div>

                                <div className="bg-white border-2 border-gray-400 border-t-gray-600 border-l-gray-600 p-3 space-y-2">
                                    {rewardPopup.gold > 0 && (
                                        <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                                            <span className="font-bold text-sm text-gray-700">💰 Gold:</span>
                                            <span className="font-bold text-yellow-600">+{formatNumber(rewardPopup.gold)}</span>
                                        </div>
                                    )}
                                    {rewardPopup.xp > 0 && (
                                        <div className="flex justify-between items-center border-b border-gray-300 pb-2">
                                            <span className="font-bold text-sm text-gray-700">⭐ Experience:</span>
                                            <span className="font-bold text-blue-600">+{formatNumber(rewardPopup.xp)}</span>
                                        </div>
                                    )}
                                    {rewardPopup.citizens > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm text-gray-700">👥 Citizens:</span>
                                            <span className="font-bold text-green-600">+{formatNumber(rewardPopup.citizens)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default Desktop;
