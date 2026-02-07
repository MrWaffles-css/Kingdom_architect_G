import React from 'react';

export default function News() {
    return (
        <div className="p-4 bg-white w-full md:min-w-[500px] h-full">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">📰 Latest News</h2>

            <div className="space-y-4">
                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-blue-800">🎉 Grand Opening!</h3>
                        <span className="text-xs text-gray-600">{new Date().toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm">
                        Welcome to Kingdom Architect! Build your kingdom, train your armies, and compete with players
                        from around the world. The realm awaits your leadership!
                    </p>
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-blue-800">⚔️ Season 1 Now Active</h3>
                        <span className="text-xs text-gray-600">{new Date().toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm">
                        The first season has begun! Compete for glory and earn legacy achievements that will
                        carry over to future seasons. May the best kingdom win!
                    </p>
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-blue-800">💎 New Features Coming Soon</h3>
                        <span className="text-xs text-gray-600">{new Date().toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm">
                        We're working on exciting new features including alliances, trading, and special events.
                        Stay tuned for updates!
                    </p>
                </div>
            </div>
        </div>
    );
}
