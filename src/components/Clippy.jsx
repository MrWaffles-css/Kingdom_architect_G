import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

const STEPS = [
    {
        id: 0,
        title: "Welcome",
        content: "Hi, I'm Clippy, your personal guide. Building a kingdom is complex! Go through this tutorial, and you'll get rewards along the way.",
        action: "Yes, please!",
        width: 300,
        // No reward for step 0
    },
    {
        id: 1,
        title: "Profile",
        content: "First, know thyself. Open the Profile window (Start -> Profile). This shows your Rank and Gold. Your Turns refill over time!",
        target_window: "profile",
        width: 300,
        rewardText: "Reward: 50 XP"
    },
    {
        id: 2,
        title: "The Goal",
        content: "The aim of the game is to build the most powerful kingdom. You need to manage your economy (Gold), population (Citizens), and military power. Climb the leaderboard and dominate your enemies!",
        action: "I'm ready!",
        width: 300,
        // No reward
    },
    {
        id: 3,
        title: "Kingdom",
        content: "Your power comes from people. Open the Kingdom window. Higher Kingdom Level = more Citizens per minute. Citizens generate Gold per minute. Task: Upgrade to Level 3.",
        target_window: "kingdom",
        width: 300,
        rewardText: "Reward: 1,000 Gold, 300 Turns"
    },
    {
        id: 4,
        title: "Economy (Part 1)",
        content: "Citizens need jobs! Go to the Gold Mine. Miners generate Gold while you sleep! Goal: Build Gold Mine (Lvl 1).",
        target_window: "gold_mine",
        width: 300,
        rewardText: "Reward: 10,600 Gold, 10 Citizens"
    },
    {
        id: 5,
        title: "Economy (Part 2)",
        content: "Now we need workers. Hire 5 Miners to start producing gold.",
        target_window: "gold_mine",
        width: 300,
        rewardText: "Reward: 1,000 XP, 25 Turns"
    },
    {
        id: 6,
        title: "Library",
        content: "Knowledge is power! Go to the Library and research 'Increase Turns per Minute'. It costs 1,000 XP but is essential for long-term growth.",
        target_window: "library",
        width: 300,
        rewardText: "Reward: 5,000 Gold"
    },
    {
        id: 7,
        title: "Unit Types",
        content: "Listen close! 4 unit types: ⚔️ Attack beats Defense. 🛡️ Defense kills Attackers. 🕵️ Spies steal intel. 👁️ Sentries catch Spies. Got it?",
        action: "Got it!",
        width: 350,
        rewardText: "Reward: 3,000 Gold, 50 XP"
    },
    {
        id: 8,
        title: "Spying Prep",
        content: "Information is key. Before we fight, we must see. Train 1 Spy in the Barracks.",
        target_window: "barracks",
        width: 300,
        rewardText: "Reward: 50 XP"
    },
    {
        id: 9,
        title: "Spying",
        content: "I've set up a dummy account. Go to the Battlefield, find 'Clippy', and Spy on me!",
        target_window: "battlefield",
        width: 300,
        rewardText: "Reward: 50 XP, 5 Turns"
    },
    {
        id: 10,
        title: "Soldiers",
        content: "Clippy has low defense, but your unarmed citizens can't win. Train 5 Attack Soldiers in the Barracks.",
        target_window: "barracks",
        width: 300,
        rewardText: "Reward: 50 XP"
    },
    {
        id: 11,
        title: "Weapons",
        content: "Soldiers need weapons! Go to the Armoury (Start -> Armoury) and buy 5 Attack Weapons to boost their strength.",
        target_window: "armoury",
        width: 300,
        rewardText: "Reward: 50 XP"
    },
    {
        id: 12,
        title: "Attacking",
        content: "Now you are ready. Go to the Battlefield, find 'Clippy', and Attack!",
        target_window: "battlefield",
        width: 300,
        rewardText: "Reward: 150 XP, 100 Gold"
    },
    {
        id: 13,
        title: "Reports",
        content: "Did you win? Check your Reports to see the battle logs.",
        target_window: "reports",
        width: 300,
        rewardText: "Reward: 50 XP"
    },
    {
        id: 14,
        title: "Vault",
        content: "Now, as you've realised, every minute you're gathering gold because your citizens and your gold miners are producing gold. You can store a percentage of this in the Vault to protect it and earn interest. Open the Vault.",
        target_window: "vault",
        width: 300,
        rewardText: "Reward: 50 XP, 5 Turns"
    },
    {
        id: 15,
        title: "Completion",
        content: "You're a pro now! Check the Help menu if you get stuck. I'll be watching... always watching. Good luck!",
        action: "Thanks, Clippy!",
        width: 300,
        rewardText: "Reward: 1,000 Gold, 200 XP"
    }
];

const RewardPopup = ({ rewards, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (!rewards) return null;

    return (
        <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 bg-yellow-100 border-2 border-yellow-500 text-yellow-900 px-4 py-2 rounded-full font-bold shadow-lg animate-reward-bounce whitespace-nowrap z-[10000]">
            {Object.entries(rewards).map(([key, value]) => (
                <div key={key} className="flex items-center justify-center gap-1">
                    <span>+{value}</span>
                    <span className="uppercase text-xs">{key}</span>
                </div>
            ))}
        </div>
    );
};

import { useGame } from '../contexts/GameContext';

export default function Clippy({ stats, openWindows, onAdvance, onNavigate }) {
    const { notification } = useGame();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(stats?.tutorial_step || 0);

    // ... (keep state)

    // Helper to render clickable keywords
    const renderContent = (text) => {
        if (!text) return null;

        const keywords = {
            "Profile": "profile",
            "Kingdom": "kingdom",
            "Gold Mine": "goldmine",
            "Library": "library",
            "Barracks": "barracks",
            "Battlefield": "battle",
            "Armoury": "armoury",
            "Reports": "reports",
            "Vault": "vault"
        };

        // Create a regex pattern from keys, ensuring longer keys match first (e.g. "Gold Mine" before "Gold" - though we don't have "Gold" as a link)
        const pattern = new RegExp(`(${Object.keys(keywords).join('|')})`, 'g');

        // Split text by regex, capture groups will be included in the array
        const parts = text.split(pattern);

        return parts.map((part, index) => {
            if (keywords[part]) {
                const targetId = keywords[part];
                return (
                    <span
                        key={index}
                        onClick={() => onNavigate && onNavigate(targetId)}
                        className="text-blue-800 underline cursor-pointer hover:text-blue-600 font-bold"
                        title={`Open ${part}`}
                    >
                        {part}
                    </span>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    // ... (keep rest of logic)

    // Scroll down to find the render part




    // Draggable State
    const [position, setPosition] = useState({
        x: Math.min(window.innerWidth / 2 - 150, window.innerWidth - 320),
        y: Math.min(window.innerHeight / 2 - 100, window.innerHeight - 300)
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const clippyRef = useRef(null);

    useEffect(() => {
        setStep(stats?.tutorial_step || 0);
    }, [stats?.tutorial_step]);

    // Handle Window Resize keeping it in bounds roughly
    useEffect(() => {
        const handleResize = () => {
            // Optional: ensure clippy stays on screen. 
            // For now we just let him reside where he is.
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const currentStepData = notification ? {
        title: "Notification",
        content: notification.message,
        width: 300,
        // No default action/reward for generic notifications
    } : STEPS.find(s => s.id === step);

    // Drag Logic
    const handleStart = (clientX, clientY) => {
        setIsDragging(true);
        dragOffset.current = {
            x: clientX - position.x,
            y: clientY - position.y
        };
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
    };

    const handleTouchStart = (e) => {
        // e.preventDefault();
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
    };

    useEffect(() => {
        const handleMove = (clientX, clientY) => {
            if (isDragging) {
                const width = clippyRef.current ? clippyRef.current.offsetWidth : 300;
                const height = clippyRef.current ? clippyRef.current.offsetHeight : 200;

                const maxX = Math.max(0, window.innerWidth - width);
                const maxY = Math.max(0, window.innerHeight - height - 40); // 40px taskbar buffer

                let newX = clientX - dragOffset.current.x;
                let newY = clientY - dragOffset.current.y;

                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));

                setPosition({ x: newX, y: newY });
            }
        };

        const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e) => {
            if (isDragging) {
                e.preventDefault(); // Prevent scroll while dragging clippy
                const touch = e.touches[0];
                handleMove(touch.clientX, touch.clientY);
            }
        };

        const handleUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging]);


    const [rewardPopup, setRewardPopup] = useState(null);
    const [rewardId, setRewardId] = useState(0);

    const handleAction = async () => {
        if (loading) return;
        try {
            setLoading(true);
            // RPC call to advance
            const { data, error } = await supabase.rpc('advance_tutorial', { expected_step: step });

            if (error) throw error;

            if (data.success) {
                // Trigger Reward Popup if rewards exist
                if (data.rewards && Object.keys(data.rewards).length > 0) {
                    setRewardPopup(data.rewards);
                    setRewardId(prev => prev + 1);
                }

                if (onAdvance) {
                    onAdvance({ tutorial_step: data.new_step });
                }
            }
        } catch (err) {
            console.error('Tutorial error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        if (loading) return;
        if (!window.confirm("Are you sure you want to skip the tutorial? You will instantly get all rewards.")) return;

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('skip_tutorial');

            if (error) throw error;

            if (data.success) {
                // Show mega reward popup
                if (data.rewards) {
                    setRewardPopup(data.rewards);
                    setRewardId(prev => prev + 1);
                }

                if (onAdvance) {
                    // Force refresh user data to sync unlocked stats
                    onAdvance({ tutorial_step: 999 });
                }
            }
        } catch (err) {
            console.error('Skip Tutorial error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-advance logic
    useEffect(() => {
        if (!openWindows) return;
        let shouldAdvance = false;

        // Step 1: Profile - Just open window
        if (step === 1 && openWindows.some(w => w.id === 'profile')) shouldAdvance = true;

        // Step 3: Kingdom - Reach Level 3
        if (step === 3 && stats && stats.kingdom_level >= 3) shouldAdvance = true;

        // Step 4: Economy Part 1 - Build Gold Mine (Level 1)
        if (step === 4 && stats && stats.gold_mine_level >= 1) shouldAdvance = true;

        // Step 5: Economy Part 2 - Hire 5 Miners
        if (step === 5 && stats && stats.miners >= 5) shouldAdvance = true;

        // Step 6: Library - Research Turns (CONDITION CHANGED: Check research level > 0)
        if (step === 6 && stats && stats.research_turns_per_min >= 1) shouldAdvance = true;

        // Step 8: Spying Prep - Train 1 Spy
        if (step === 8 && stats && stats.spies > 0) shouldAdvance = true;

        // Step 10: Soldiers - Train 5 Attack Soldiers
        if (step === 10 && stats && stats.attack_soldiers >= 5) shouldAdvance = true;

        // Step 11: Weapons - Buy 5 Attack Weapons
        if (step === 11 && stats && stats.attack_weapons >= 5) shouldAdvance = true;

        // Step 13: Reports - Just open window
        if (step === 13 && openWindows.some(w => w.id === 'reports')) shouldAdvance = true;

        // Step 14: Vault - Just open window
        if (step === 14 && openWindows.some(w => w.id === 'vault')) shouldAdvance = true;

        if (shouldAdvance) {
            handleAction();
        }
    }, [openWindows, step, stats]);

    // Polling logic removed - Battle system triggers advances directly for Steps 9 & 12

    if (!stats) return null;

    if (!currentStepData) return null;

    return (
        <div
            ref={clippyRef}
            className="fixed z-[9999] flex flex-col items-center gap-2"
            style={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'grab'
            }}
        >
            {/* Talk Bubble */}
            <div
                className="bg-[#ffffcc] border border-black rounded-lg p-3 text-sm text-black relative shadow-md pointer-events-auto"
                style={{ width: currentStepData.width }}
            >
                <div className="font-bold mb-1">{currentStepData.title}</div>
                <div className="mb-2 whitespace-pre-wrap">{renderContent(currentStepData.content)}</div>

                {/* Reward Display */}
                {currentStepData.rewardText && (
                    <div className="mb-2 p-1 bg-green-100 border border-green-300 rounded text-xs text-green-800 font-bold flex items-center gap-1">
                        🎁 {currentStepData.rewardText}
                    </div>
                )}

                {currentStepData.target_window && !currentStepData.action && (
                    <div className="text-xs text-gray-500 italic">
                        {/* Custom hint for training steps vs opening window steps */}
                        {(step === 4 || step === 5 || step === 6 || step === 8 || step === 9 || step === 10 || step === 11)
                            ? "Waiting for completion..."
                            : "Waiting for you to open window..."}
                    </div>
                )}

                {currentStepData.action && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleAction}
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking button
                            disabled={loading}
                            className="flex-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white px-2 py-1 font-bold text-xs hover:bg-white"
                        >
                            {loading ? 'Processing...' : currentStepData.action}
                        </button>

                        {/* SKIP BUTTON - Only on Step 0 */}
                        {step === 0 && (
                            <button
                                onClick={handleSkip}
                                onMouseDown={(e) => e.stopPropagation()}
                                disabled={loading}
                                className="bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white px-2 py-1 font-bold text-xs hover:bg-red-100 text-red-800"
                                title="Skip Tutorial & Get All Rewards"
                            >
                                Skip
                            </button>
                        )}
                    </div>
                )}

                {/* Tail pointing down to Clippy */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#ffffcc] border-r border-b border-black transform rotate-45"></div>
            </div>

            {/* Clippy Image - Made Bigger and Clickable for Drag */}
            <img
                src="/assets/clippy_v3.png"
                alt="Clippy"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="w-40 h-40 object-contain drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)] animate-bounce-subtle pointer-events-auto hover:brightness-110 touch-none"
                draggable={false} // HTML5 drag disable
            />

            {/* Reward Animation Popup */}
            {rewardPopup && <RewardPopup key={rewardId} rewards={rewardPopup} onClose={() => setRewardPopup(null)} />}
        </div>
    );
}
