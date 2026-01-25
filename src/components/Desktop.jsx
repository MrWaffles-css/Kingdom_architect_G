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
    const [openWindows, setOpenWindows] = useState([]);
    const [activeWindowId, setActiveWindowId] = useState(null);
    const [startMenuOpen, setStartMenuOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState(null);
    const [unreadMailCount, setUnreadMailCount] = useState(0);
    const [viewingUserName, setViewingUserName] = useState(null);

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
    const { desktopLayout, saveDesktopLayout } = useGame();
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
        }
    };

    const handleMouseUp = () => {
        if (dragState) {
            saveDesktopLayout(localLayout);
            setDragState(null);
        }
    };

    const openWindow = (featureId, extraProps = {}) => {
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
            icon: feature.isImage ? <img src={feature.icon} alt="" className="w-4 h-4" /> : feature.icon,
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

    return (
        <div
            className="w-full h-screen bg-[#008080] overflow-hidden relative font-sans text-sm select-none"
            onClick={() => setStartMenuOpen(false)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
        >
            <MobileTopBar stats={stats} />

            {/* Desktop Icons */}
            {features.map((feature, index) => {
                const position = localLayout[feature.id] || getDefaultPosition(index);
                // Dynamically ensure Y is at least 60 (approx 50px safe) if on mobile
                const displayY = isMobile ? Math.max(position.y, 60) : position.y;

                if (feature.hidden) return null;

                return (
                    <React.Fragment key={feature.id}>
                        <DesktopIcon
                            label={feature.title}
                            icon={feature.isImage ? <img src={feature.icon} alt={feature.title} className={`${feature.iconClassName || 'w-8 h-8'} pixelated`} /> : feature.icon}
                            onClick={() => {
                                if (!dragMoved.current) {
                                    openWindow(feature.id);
                                }
                            }}
                            badge={feature.id === 'mail' ? unreadMailCount : 0}
                            style={{ left: position.x, top: displayY }}
                            onMouseDown={(e) => handleIconDragStart(e, feature.id)}
                            className="absolute"
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
                    onUpdate: (newStats) => {
                        setStats(prev => ({ ...prev, ...newStats }));
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
                    >
                        <Component {...props} />
                    </Window>
                );
            })}

            {/* Special Windows (Modals -> Windows) */}
            {showAdmin && (
                <Window
                    title="Admin Panel"
                    isOpen={true}
                    onClose={() => setShowAdmin(false)}
                    onMinimize={() => { }}
                    isActive={true}
                    onFocus={() => { }}
                    width={600}
                >
                    <AdminPanel
                        onClose={() => setShowAdmin(false)}
                        onUserUpdate={() => refreshUserData(session.user.id)}
                        onWorldReset={() => {
                            setStats({ gold: 0, experience: 600, turns: 0, vault: 0, rank: 1, citizens: 2, kingdom_level: 0, tutorial_step: 0 });
                            refreshUserData(session.user.id);
                        }}
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
                                <img src="https://win98icons.alexmeub.com/icons/png/users-1.png" alt="" className="w-6 h-6" />
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
                                <img src="/kingdom_icon.png" alt="" className="w-6 h-6" />
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
                                <img src="/goldmine_icon.png" alt="" className="w-6 h-6" />
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
                                <img src="/library_icon.png" alt="" className="w-6 h-6" />
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
                                <img src="/barracks_icon.png" alt="" className="w-6 h-6" />
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
                                <img src="/battlefield_icon.png" alt="" className="w-6 h-6" />
                                <span className="text-sm">Battlefield</span>
                            </button>
                            {(stats?.tutorial_step === 9 || stats?.tutorial_step === 12) && <GuideArrow className="right-[-40px] top-2" />}
                        </div>

                        {/* Vault */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('vault'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="/vault_icon.png" alt="" className="w-6 h-6" />
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
                                <img src="/armoury_icon.png" alt="" className="w-6 h-6" />
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
                                <img src="https://win98icons.alexmeub.com/icons/png/envelope_closed-0.png" alt="" className="w-6 h-6" />
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
                                    <img src="https://win98icons.alexmeub.com/icons/png/joystick-0.png" alt="" className="w-6 h-6" />
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
                                        <img src="https://win98icons.alexmeub.com/icons/png/minesweeper-0.png" alt="" className="w-4 h-4" />
                                        <span className="text-sm">Minesweeper</span>
                                    </button>
                                    <button
                                        onClick={() => { openWindow('games', { initialGame: 'solitaire' }); setActiveSubmenu(null); setStartMenuOpen(false); }}
                                        className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                                    >
                                        <img src="https://win98icons.alexmeub.com/icons/png/solitaire-0.png" alt="" className="w-4 h-4" />
                                        <span className="text-sm">Solitaire</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Recycle Bin */}
                        <div className="relative">
                            <button
                                onClick={() => { openWindow('recycle'); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="https://win98icons.alexmeub.com/icons/png/recycle_bin_empty-0.png" alt="" className="w-6 h-6" />
                                <span className="text-sm">Recycle Bin</span>
                            </button>
                        </div>

                        <div className="h-px bg-gray-400 my-1 shadow-[0_1px_0_white]"></div>

                        {isAdmin && (
                            <button
                                onClick={() => { setShowAdmin(true); setStartMenuOpen(false); }}
                                className="w-full text-left px-2 py-1 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            >
                                <img src="https://win98icons.alexmeub.com/icons/png/settings_gear-0.png" alt="" className="w-6 h-6" />
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
                                <img src="https://win98icons.alexmeub.com/icons/png/shut_down_with_computer-0.png" alt="" className="w-6 h-6" />
                                <span className="text-sm">Log Off</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Taskbar
                openWindows={openWindows}
                activeWindowId={activeWindowId}
                onWindowClick={(id) => {
                    const win = openWindows.find(w => w.id === id);
                    if (win.isMinimized) {
                        toggleMinimize(id);
                        setActiveWindowId(id);
                    } else if (activeWindowId === id) {
                        toggleMinimize(id);
                    } else {
                        setActiveWindowId(id);
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
                onAdvance={(updates) => {
                    if (updates) {
                        setStats(prev => ({ ...prev, ...updates }));
                    }
                    refreshUserData(session.user.id);
                }}
            />
        </div >
    );
};

export default Desktop;
