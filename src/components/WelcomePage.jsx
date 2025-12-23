import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import logo from '../assets/logo.png';
import Auth from './Auth';
import DesktopIcon from './DesktopIcon';
import News from './News';
import PatchNotes from './PatchNotes';
import About from './About';
import Help from './Help';

export default function WelcomePage({ onLogin }) {
    const [startMenuOpen, setStartMenuOpen] = useState(false);
    const [activeWindow, setActiveWindow] = useState(null);
    const [nextSeasonStart, setNextSeasonStart] = useState(null);
    const [timeLeftToStart, setTimeLeftToStart] = useState('');
    const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

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

    const openWindow = (windowType) => {
        setActiveWindow(windowType);
        setStartMenuOpen(false);
    };

    const closeWindow = () => {
        setActiveWindow(null);
    };

    const desktopIcons = [
        { id: 'login', label: 'Login', icon: '🔑', action: () => openWindow('login') },
        { id: 'register', label: 'Register', icon: '📝', action: () => openWindow('register') },
        { id: 'news', label: 'News', icon: '📰', action: () => openWindow('news') },
        { id: 'patch', label: 'Patch Notes', icon: '📋', action: () => openWindow('patch') },
        { id: 'about', label: 'About', icon: 'ℹ️', action: () => openWindow('about') },
        { id: 'help', label: 'Help', icon: '❓', action: () => openWindow('help') },
    ];

    return (
        <div
            className="w-full h-screen bg-[#008080] overflow-hidden relative font-sans text-sm select-none flex flex-col"
            onClick={() => setStartMenuOpen(false)}
        >
            {/* Desktop Icons - Mobile Friendly Flow */}
            <div className="absolute top-0 left-0 bottom-10 right-0 p-4 flex flex-col flex-wrap gap-4 content-start pointer-events-none z-10 md:block md:p-0">
                {desktopIcons.map((item, index) => (
                    <div
                        key={item.id}
                        className="pointer-events-auto md:absolute"
                        style={{
                            // Applied when position is absolute (on desktop via md:absolute)
                            top: 20 + (index * 100),
                            left: 20
                        }}
                    >
                        <DesktopIcon
                            label={item.label}
                            icon={item.icon}
                            onClick={(e) => { e.stopPropagation(); item.action(); }}
                        // DesktopIcon is static inside the positioned wrapper on desktop
                        />
                    </div>
                ))}
            </div>

            {/* Desktop Content */}
            <div className="flex-1 flex items-center justify-center p-4 md:p-8 z-0">
                <div className="text-center w-full max-w-md md:max-w-xl">
                    <div className="mb-4 md:mb-8">
                        <img src={logo} alt="Kingdom Architect" className="w-64 md:w-96 h-auto mb-4 pixelated mx-auto drop-shadow-2xl" />

                        {timeLeftToStart ? (
                            <div className="w-64 mx-auto bg-[#c0c0c0] border-2 border-white border-r-black border-b-black p-[2px] shadow-xl text-left relative">
                                <div className="bg-[#000080] px-1 py-[2px] mb-2 flex justify-between items-center bg-gradient-to-r from-[#000080] to-[#1084d0]">
                                    <span className="text-white font-bold text-xs pl-1">Season Countdown</span>
                                </div>
                                <div className="px-4 py-4 text-center">
                                    <div className="text-xs mb-2 font-bold text-black">New Era Begins In:</div>
                                    <div className="bg-black border-2 border-gray-500 border-b-white border-r-white p-2 shadow-inner">
                                        <span className="font-mono text-2xl text-[#00ff00] font-bold tracking-widest leading-none block">
                                            {timeLeftToStart}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => openWindow('login')}
                                className="mx-auto mt-8 px-6 py-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black text-black font-bold text-lg active:border-t-black active:border-l-black active:border-r-white active:border-b-white shadow-[1px_1px_0px_#000] active:shadow-none active:translate-y-[1px] flex items-center gap-2"
                            >
                                <span className="text-xl">🔑</span> Login to Kingdom
                            </button>
                        )}
                    </div>

                    <p className="text-white text-2xl font-bold mb-4 drop-shadow-lg">Welcome to Kingdom Architect</p>

                    <p className="text-white text-lg drop-shadow-md">Click the Start button to begin your journey</p>
                </div>
            </div>

            {/* Windows */}
            {activeWindow === 'login' && (
                <WindowWrapper title="Login" onClose={closeWindow}>
                    <Auth onLogin={onLogin} mode="login" />
                </WindowWrapper>
            )}

            {activeWindow === 'register' && (
                <WindowWrapper title="Register" onClose={closeWindow}>
                    <Auth onLogin={onLogin} mode="register" />
                </WindowWrapper>
            )}

            {activeWindow === 'news' && (
                <WindowWrapper title="News" onClose={closeWindow}>
                    <News />
                </WindowWrapper>
            )}

            {activeWindow === 'patch' && (
                <WindowWrapper title="Patch Notes" onClose={closeWindow}>
                    <PatchNotes />
                </WindowWrapper>
            )}

            {activeWindow === 'about' && (
                <WindowWrapper title="About Kingdom Architect" onClose={closeWindow}>
                    <About />
                </WindowWrapper>
            )}

            {activeWindow === 'help' && (
                <WindowWrapper title="Help" onClose={closeWindow}>
                    <Help />
                </WindowWrapper>
            )}

            {/* Start Menu */}
            {startMenuOpen && (
                <div
                    className="absolute bottom-10 left-0 w-64 bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080] shadow-xl z-[100] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-[#000080] text-white p-2 text-xl vertical-text flex items-end w-8 absolute bottom-0 top-0 left-0 overflow-visible">
                        <div className="-rotate-90 origin-bottom-left translate-x-8 mb-4 whitespace-nowrap flex gap-1 items-baseline">
                            <span className="font-extrabold tracking-tighter text-2xl">Kingdom</span>
                            <span className="font-normal text-2xl">98</span>
                        </div>
                    </div>
                    <div className="pl-10 pr-1 py-1 flex flex-col gap-1">
                        <button
                            className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            onClick={() => openWindow('login')}
                        >
                            <span className="text-xl">🔑</span>
                            <span className="font-bold">Login</span>
                        </button>
                        <button
                            className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            onClick={() => openWindow('register')}
                        >
                            <span className="text-xl">📝</span>
                            <span className="font-bold">Register</span>
                        </button>
                        <hr className="border-t border-white border-b-[#808080] my-1" />
                        <button
                            className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            onClick={() => openWindow('news')}
                        >
                            📰 News
                        </button>
                        <button
                            className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            onClick={() => openWindow('patch')}
                        >
                            📋 Patch Notes
                        </button>
                        <button
                            className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            onClick={() => openWindow('about')}
                        >
                            ℹ️ About
                        </button>
                        <button
                            className="text-left px-2 py-2 hover:bg-[#000080] hover:text-white flex items-center gap-2"
                            onClick={() => openWindow('help')}
                        >
                            ❓ Help
                        </button>
                    </div>
                </div>
            )}

            {/* Taskbar */}
            <div className="h-10 bg-[#c0c0c0] border-t-2 border-white flex items-center px-1 z-50 select-none">
                <button
                    className="flex items-center gap-1 font-bold px-2 py-1 mr-2 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white active:bg-gray-300 shadow active:shadow-none transition-none"
                    onClick={(e) => { e.stopPropagation(); setStartMenuOpen(!startMenuOpen); }}
                    style={{ minWidth: '60px' }}
                >
                    <img src="https://win98icons.alexmeub.com/icons/png/windows_slanted-1.png" alt="" className="w-4 h-4" />
                    Start
                </button>

                <div className="w-[2px] h-6 bg-gray-500 border-r border-white mx-1"></div>

                <div className="flex-1"></div>

                <div className="border border-gray-500 border-r-white border-b-white px-3 py-1 bg-[#c0c0c0] ml-2 font-sans text-xs shadow-[inset_1px_1px_0px_#000]">
                    {time}
                </div>
            </div>
        </div>
    );
}

function WindowWrapper({ title, onClose, children }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div
                className="bg-[#c0c0c0] shadow-xl border-2 border-white border-r-gray-600 border-b-gray-600 w-full h-[calc(100dvh-2.5rem-env(safe-area-inset-bottom))] md:w-auto md:h-auto md:max-w-[90vw] md:max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Title Bar */}
                <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] p-1 flex justify-between items-center shrink-0">
                    <div className="text-white font-bold flex items-center gap-1 pl-1">
                        {title}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-4 h-3.5 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black flex items-center justify-center font-bold text-[8px] hover:bg-gray-300"
                    >
                        ✕
                    </button>
                </div>
                {/* Content */}
                <div className="overflow-auto flex-1 md:max-h-[calc(90vh-30px)]">
                    {children}
                </div>
            </div>
        </div>
    );
}


