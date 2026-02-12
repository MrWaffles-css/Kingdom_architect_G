import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import logo from '../assets/logo.png';
import Auth from './Auth';
import DesktopIcon from './DesktopIcon';
import News from './News';
import PatchNotes from './PatchNotes';
import About from './About';
import Help from './Help';
import HallOfFame from './HallOfFame';
import BootSequence from './BootSequence';
import DraggableWindow from './DraggableWindow';
import CDPlayer from './CDPlayer';
import { useSound } from '../contexts/SoundContext';

export default function WelcomePage({ onLogin }) {
    const [bootComplete, setBootComplete] = useState(false);
    const [startMenuOpen, setStartMenuOpen] = useState(false);
    const [activeWindows, setActiveWindows] = useState([]);
    const [activeWindow, setActiveWindow] = useState(null);

    const [nextSeasonStart, setNextSeasonStart] = useState(null);
    const [timeLeftToStart, setTimeLeftToStart] = useState('');
    const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Selection Box State
    const [selectionBox, setSelectionBox] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const { playSound, playStartupSound } = useSound();

    const handleMouseDown = (e) => {
        // Only start selection if left click and not on specific elements
        if (e.button !== 0) return;

        // Start selection updates
        setSelectionBox({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
        });
    };

    const handleMouseMove = (e) => {
        if (selectionBox) {
            setSelectionBox(prev => ({
                ...prev,
                currentX: e.clientX,
                currentY: e.clientY
            }));
        }
    };

    const handleMouseUp = () => {
        setSelectionBox(null);
    };

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

    React.useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 1000);

        // Fetch Next Season Start
        const fetchNextSeasonStart = async () => {
            const { data } = await supabase
                .from('game_settings')
                .select('value')
                .eq('key', 'next_season_start')
                .single();
            if (data?.value?.start_time) {
                setNextSeasonStart(new Date(data.value.start_time));
            }
        };
        fetchNextSeasonStart();

        return () => clearInterval(timer);
    }, []);

    // Countdown Logic
    useEffect(() => {
        if (!nextSeasonStart) return;

        const updateTimer = () => {
            const now = new Date();
            const diff = nextSeasonStart - now;
            if (diff <= 0) {
                setTimeLeftToStart(null);
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                const pad = n => n.toString().padStart(2, '0');

                let str = '';
                if (days > 0) str += `${days}d `;
                str += `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                setTimeLeftToStart(str);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [nextSeasonStart]);

    const handleBootComplete = () => {
        setBootComplete(true);
        playStartupSound();
    };

    const openWindow = (windowType) => {
        playSound('click');
        setActiveWindow(windowType);
        setStartMenuOpen(false);
    };

    const closeWindow = () => {
        setActiveWindow(null);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => {
        if (contextMenu) setContextMenu(null);
    };

    const handleDesktopClick = (e) => {
        setStartMenuOpen(false);
        closeContextMenu();
        // propagate for selection box
    };

    const desktopIcons = [
        { id: 'login', label: 'Login', icon: "https://win98icons.alexmeub.com/icons/png/keys-0.png", action: () => openWindow('login') },
        { id: 'register', label: 'Register', icon: "https://win98icons.alexmeub.com/icons/png/write_wordpad-0.png", action: () => openWindow('register') },
        { id: 'news', label: 'News', icon: "/news_icon.png", action: () => openWindow('news') },
        { id: 'patch', label: 'Patch Notes', icon: "https://win98icons.alexmeub.com/icons/png/notepad-0.png", action: () => openWindow('patch') },
        { id: 'about', label: 'About', icon: "https://win98icons.alexmeub.com/icons/png/msg_information-0.png", action: () => openWindow('about') },
        { id: 'help', label: 'Help', icon: "https://win98icons.alexmeub.com/icons/png/help_question_mark-0.png", action: () => openWindow('help') },
        { id: 'halloffame', label: 'Hall of Fame', icon: "/hall_of_fame_icon.png", action: () => openWindow('halloffame') },
        { id: 'cd_player', label: 'CD Player', icon: "https://win98icons.alexmeub.com/icons/png/cd_audio-0.png", action: () => openWindow('cd_player') },
    ];

    if (!bootComplete) {
        return <BootSequence onComplete={handleBootComplete} />;
    }

    return (
        <div
            className="w-full h-screen bg-[#008080] overflow-hidden relative font-sans text-sm select-none flex flex-col desktop-container"
            onClick={handleDesktopClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
        >
            {/* Selection Box */}
            {selectionBox && <div style={getSelectionBoxStyle()} />}

            {/* Desktop Icons - Mobile Friendly Flow */}
            <div className="absolute top-0 left-0 bottom-10 right-0 p-4 flex flex-col flex-wrap gap-6 content-start pointer-events-none z-10 md:block md:p-0">
                {desktopIcons.map((item, index) => (
                    <div
                        key={item.id}
                        className="pointer-events-auto md:absolute stagger-appear"
                        style={{
                            // Applied when position is absolute (on desktop via md:absolute)
                            top: 20 + (index * 100),
                            left: 20,
                            animationDelay: `${index * 100}ms`
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <DesktopIcon
                            label={item.label}
                            icon={<img src={item.icon} alt={item.label} className="w-12 h-12 pixelated filter drop-shadow-md" />}
                            onClick={(e) => {
                                e.stopPropagation();
                                item.action();
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Desktop Background Content (Logo etc) */}
            <div className="flex-1 flex items-center justify-center p-4 md:p-8 z-0">
                <div className="text-center w-full max-w-md md:max-w-xl opacity-80 pointer-events-none">
                    <div className="mb-4 md:mb-8">
                        <img src={logo} alt="Kingdom Architect" className="w-48 md:w-96 h-auto mb-4 pixelated mx-auto drop-shadow-2xl animate-float" draggable="false" />

                        {timeLeftToStart && (
                            <div className="w-64 mx-auto bg-[#c0c0c0] border-2 border-white border-r-black border-b-black p-[2px] shadow-xl text-left relative pointer-events-auto">
                                <div className="bg-[#000080] px-1 py-[2px] mb-2 flex justify-between items-center bg-gradient-to-r from-[#000080] to-[#1084d0]">
                                    <span className="text-white font-bold text-xs pl-1">Season Countdown</span>
                                </div>
                                <div className="px-4 py-4 text-center">
                                    <div className="text-xs mb-2 font-bold text-black">New Season Begins In:</div>
                                    <div className="bg-black border-2 border-gray-500 border-b-white border-r-white p-2 shadow-inner">
                                        <span className="font-mono text-2xl text-[#00ff00] font-bold tracking-widest leading-none block">
                                            {timeLeftToStart}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Draggable Windows */}
            {activeWindow === 'login' && (
                <DraggableWindow
                    title="Login"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'login').icon}
                >
                    <Auth onLogin={onLogin} mode="login" />
                </DraggableWindow>
            )}

            {activeWindow === 'register' && (
                <DraggableWindow
                    title="Register"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'register').icon}
                >
                    <Auth onLogin={onLogin} mode="register" />
                </DraggableWindow>
            )}

            {activeWindow === 'news' && (
                <DraggableWindow
                    title="News"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'news').icon}
                    minWidth={500}
                >
                    <News />
                </DraggableWindow>
            )}

            {activeWindow === 'patch' && (
                <DraggableWindow
                    title="Patch Notes"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'patch').icon}
                    minWidth={500}
                >
                    <PatchNotes />
                </DraggableWindow>
            )}

            {activeWindow === 'about' && (
                <DraggableWindow
                    title="About Kingdom Architect"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'about').icon}
                >
                    <About />
                </DraggableWindow>
            )}

            {activeWindow === 'help' && (
                <DraggableWindow
                    title="Help"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'help').icon}
                >
                    <Help />
                </DraggableWindow>
            )}

            {activeWindow === 'halloffame' && (
                <DraggableWindow
                    title="Hall of Fame"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'halloffame').icon}
                    minWidth={600}
                >
                    <HallOfFame />
                </DraggableWindow>
            )}

            {activeWindow === 'cd_player' && (
                <DraggableWindow
                    title="CD Player"
                    onClose={closeWindow}
                    isActive={true}
                    icon={desktopIcons.find(i => i.id === 'cd_player').icon}
                    minWidth={400}
                >
                    <CDPlayer onClose={closeWindow} />
                </DraggableWindow>
            )}


            {/* Start Menu */}
            {startMenuOpen && (
                <div
                    className="absolute bottom-10 left-0 w-64 bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080] shadow-xl z-[100] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="bg-[#000080] text-white p-2 text-xl vertical-text flex items-end w-8 absolute bottom-0 top-0 left-0 overflow-visible">
                        <div className="-rotate-90 origin-bottom-left translate-x-8 mb-4 whitespace-nowrap flex gap-1 items-baseline">
                            <span className="font-extrabold tracking-tighter text-2xl">Kingdom</span>
                            <span className="font-normal text-2xl">98</span>
                        </div>
                    </div>
                    <div className="pl-10 pr-1 py-1 flex flex-col gap-1">
                        {desktopIcons.map(icon => (
                            <button
                                key={icon.id}
                                className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2 group"
                                onClick={() => openWindow(icon.id)}
                            >
                                <img src={icon.icon} alt="" className="w-6 h-6 pixelated" />
                                <span className="font-bold text-black group-hover:text-white">{icon.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="absolute bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 shadow-xl z-[150] flex flex-col w-40"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button className="text-left px-4 py-1 hover:bg-[#000080] hover:text-white text-black text-sm" onClick={() => { playSound('click'); window.location.reload(); }}>Refresh</button>
                    <hr className="border-t border-gray-400 border-b-white my-[1px]" />
                    <button className="text-left px-4 py-1 hover:bg-[#000080] hover:text-white text-black text-sm" onClick={() => { playSound('click'); openWindow('about'); }}>Properties</button>
                </div>
            )}

            {/* Taskbar */}
            <div className="h-10 bg-[#c0c0c0] border-t-2 border-white flex items-center px-1 z-50 select-none">
                <button
                    className={`flex items-center gap-1 font-bold px-2 py-1 mr-2 border-2 active:border-black active:border-r-white active:border-b-white active:bg-gray-300 shadow active:shadow-none transition-none
                        ${startMenuOpen
                            ? 'bg-gray-300 border-black border-r-white border-b-white'
                            : 'bg-[#c0c0c0] border-white border-r-black border-b-black'
                        }
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        playSound('click');
                        setStartMenuOpen(!startMenuOpen);
                    }}
                    style={{ minWidth: '60px' }}
                >
                    <img src="/start_icon.png" alt="" className="w-6 h-6" draggable="false" />
                    Start
                </button>

                <div className="w-[2px] h-6 bg-gray-500 border-r border-white mx-1"></div>

                {/* Active Window Taskbar Item */}
                {activeWindow && (
                    <button
                        className="flex items-center gap-1 px-2 py-1 bg-gray-300 border-2 border-black border-r-white border-b-white shadow-inner max-w-[150px] truncate active:bg-gray-400"
                    >
                        <img src={desktopIcons.find(i => i.id === activeWindow)?.icon} className="w-4 h-4" />
                        <span className="font-bold text-xs truncate">{desktopIcons.find(i => i.id === activeWindow)?.label}</span>
                    </button>
                )}

                <div className="flex-1"></div>

                <div className="border border-gray-500 border-r-white border-b-white px-3 py-1 bg-[#c0c0c0] ml-2 font-sans text-xs shadow-[inset_1px_1px_0px_#000] flex items-center gap-2">
                    <img src="https://win98icons.alexmeub.com/icons/png/loudspeaker_rays-0.png" className="w-4 h-4" alt="Sound" />
                    {time}
                </div>
            </div>
        </div>
    );
}
