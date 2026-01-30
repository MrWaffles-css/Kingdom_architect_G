import React from 'react';

export default function About() {
    return (
        <div className="p-4 bg-white min-w-[350px] md:min-w-[500px] h-full flex flex-col">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">ℹ️ About Kingdom Architect</h2>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm">
                <div className="border border-gray-400 p-4 bg-gray-50 text-center">
                    <h1 className="text-xl font-bold text-[#000080]">Kingdom Architect</h1>
                    <p className="text-gray-600 font-bold">Version 1.0.0</p>
                    <p className="text-xs text-gray-500 mt-1">© 2026 Kingdom Architect Inc.</p>
                </div>

                <div className="space-y-2">
                    <p>
                        <strong>Kingdom Architect</strong> is a multiplayer strategy game where you build your own kingdom, train armies, and compete against other players.
                    </p>
                    <p>
                        Starting with a small plot of land, you must manage your citizens, mine for gold, and research powerful technologies to become the dominant force in the realm.
                    </p>
                </div>

                <div className="border-t border-gray-300 pt-3 mt-4">
                    <h3 className="font-bold mb-1">Key Features</h3>
                    <ul className="list-disc list-inside ml-2 text-gray-700 space-y-1">
                        <li>Real-time Kingdom Management</li>
                        <li>PvP Battles & Spying</li>
                        <li>Alliance System</li>
                        <li>Deep Research Tree</li>
                        <li>Ranking System</li>
                        <li>PvE Boss Raids</li>
                    </ul>
                </div>

                <div className="border-t border-gray-300 pt-3 mt-4 text-center text-xs text-gray-500">
                    <p>Developed for the modern retro web.</p>
                </div>
            </div>
        </div>
    );
}
