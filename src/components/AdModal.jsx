import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

const AdModal = ({ onClose, onSuccess }) => {
    const [secondsLeft, setSecondsLeft] = useState(15);
    const [canClaim, setCanClaim] = useState(false);
    const [adBlockDetected, setAdBlockDetected] = useState(false);
    const adRef = useRef(null);

    // Initial Ad Limit Check / AdBlock Detection
    useEffect(() => {
        // Try to push the ad
        try {
            if (window.adsbygoogle) {
                // We just push an empty object to trigger the ad fill
                // based on the ins tag we render below
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } else {
                // If adsbygoogle is not defined even though script is in head -> blocked
                // Or script failed to load
                setAdBlockDetected(true);
            }
        } catch (e) {
            console.error("Ad push error:", e);
            setAdBlockDetected(true);
        }

        // Timer
        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setCanClaim(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleClaim = async () => {
        try {
            const { data, error } = await supabase.rpc('activate_ad_bonus');
            if (error) throw error;
            if (data) {
                onSuccess(data);
            }
            onClose();
        } catch (err) {
            console.error("Failed to activate bonus:", err);
            alert("Failed to claim reward. Please try again.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="window w-full max-w-[600px] shadow-2xl animate-scale-up">
                <div className="title-bar">
                    <div className="title-bar-text">📺 Watch Ad for Reward</div>
                    <div className="title-bar-controls">
                        <button aria-label="Close" onClick={onClose} disabled={!canClaim}></button>
                    </div>
                </div>
                <div className="window-body flex flex-col items-center gap-4 p-4 text-center">

                    <h3 className="text-xl font-bold text-[#000080]">2x Income for 2 Hours!</h3>
                    <p className="text-sm">Support the server by watching this ad from our sponsor.</p>

                    {/* Ad Container */}
                    <div className="w-[300px] h-[250px] bg-white border-2 border-gray-400 flex items-center justify-center relative overflow-hidden">
                        {adBlockDetected ? (
                            <div className="text-red-600 font-bold p-4 bg-red-100 w-full h-full flex flex-col items-center justify-center">
                                <span className="text-3xl mb-2">🛑</span>
                                <p>Ad Blocker Detected</p>
                                <p className="text-xs font-normal mt-2">Please disable your ad blocker to claim this reward.</p>
                            </div>
                        ) : (
                            <div ref={adRef} className="w-full h-full">
                                {/* Google AdSense Unit */}
                                <ins className="adsbygoogle"
                                    style={{ display: 'inline-block', width: '300px', height: '250px' }}
                                    data-ad-client="ca-pub-2205424792213305"
                                /* You might need a specific slot ID if using ad units, 
                                   but auto-ads or generic push might try to fill. 
                                   Ideally user provides a slot ID. Since they didn't, we try generic. 
                                   However, AdSense usually requires a data-ad-slot. 
                                   
                                   If the user only provided the verification script, 
                                   Display Ads might not work without a slot ID created in AdSense console.
                                   
                                   We will try to render it. If it fails (blank), the timer still works.
                                */
                                /* Note: Without a valid slot ID, this might show blank space. 
                                   We'll assume the user might not have created a unit yet, 
                                   but sticking to the plan: show the box. */
                                >
                                </ins>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 w-full max-w-[300px]">
                        <button
                            onClick={handleClaim}
                            disabled={!canClaim || adBlockDetected}
                            className={`px-6 py-2 border-2 text-sm font-bold transition-all
                                ${canClaim && !adBlockDetected
                                    ? 'border-white border-r-black border-b-black active:translate-y-[1px] bg-green-600 text-white hover:bg-green-700'
                                    : 'border-white border-r-gray-500 border-b-gray-500 bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                        >
                            {canClaim ? '💰 CLAIM 2x INCOME 💰' : `Claim in ${secondsLeft}s...`}
                        </button>
                        <button onClick={onClose} className="text-xs underline hover:text-blue-800">
                            No thanks, I hate money
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AdModal;
