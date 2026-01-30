import React, { useEffect, useState } from 'react';

export default function LoadingScreen() {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("Connecting to server...");

    useEffect(() => {
        // Fake progress animation
        const interval = setInterval(() => {
            setProgress(old => {
                if (old >= 100) return 0;
                // Random increment
                return Math.min(old + Math.random() * 15, 100);
            });
        }, 500);

        // Rotating status text
        const texts = [
            "Handshaking with server...",
            "Downloading terrain data...",
            "Synchronizing castle blueprints...",
            "Polishing armor...",
            "Counting gold coins...",
            "Establishing secure connection..."
        ];

        const textInterval = setInterval(() => {
            setStatusText(texts[Math.floor(Math.random() * texts.length)]);
        }, 2000);

        return () => {
            clearInterval(interval);
            clearInterval(textInterval);
        }
    }, []);

    return (
        <div className="fixed inset-0 bg-[#008080] z-[9999] flex items-center justify-center font-sans">
            {/* Windows 98 Dialog Style */}
            <div className="w-[300px] bg-[#c0c0c0] border-2 border-[#dfdfdf] border-r-black border-b-black shadow-xl p-1">

                {/* Title Bar */}
                <div className="bg-[#000080] px-2 py-1 flex items-center justify-between mb-4">
                    <span className="text-white font-bold text-xs tracking-wide">Netscape Kingdom Navigator</span>
                    <button className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black flex items-center justify-center text-[10px] active:border-black active:border-r-white active:border-b-white leading-none pb-1">×</button>
                </div>

                {/* Content */}
                <div className="px-4 pb-4">
                    <div className="flex items-start gap-4 mb-4">
                        {/* PC Icon (CSS Art) */}
                        <div className="relative w-12 h-10 mt-1">
                            <div className="absolute inset-0 bg-[#dfdfdf] border-2 border-gray-600 border-r-white border-b-white"></div>
                            <div className="absolute top-1 left-1 right-1 bottom-3 bg-black"></div>
                            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-400"></div>
                            <div className="absolute bottom-1 right-1 w-1 h-1 bg-green-500 animate-pulse"></div>
                        </div>

                        <div className="text-xs text-black">
                            <p className="mb-2">Opening page http://kingdom.architect/...</p>
                            <p className="mb-2 font-bold">{statusText}</p>
                        </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="border border-gray-600 border-r-white border-b-white h-5 bg-gray-200 p-[2px] relative">
                        {/* Progress Bar Fill */}
                        <div
                            className="h-full bg-[#000080] transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${progress}%` }}
                        >
                            {/* Shine */}
                            <div className="absolute top-0 bottom-0 left-0 right-0 bg-white opacity-10"></div>
                        </div>
                    </div>

                    <div className="flex justify-center mt-4">
                        <button className="px-6 py-1 border-2 border-white border-r-black border-b-black text-xs active:border-black active:border-r-white active:translate-y-[1px] bg-[#c0c0c0]">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
