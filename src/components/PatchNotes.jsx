import React from 'react';

export default function PatchNotes() {
    return (
        <div className="p-4 bg-white min-w-[500px] h-full">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">📋 Patch Notes</h2>

            <div className="space-y-4">
                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold text-blue-800 mb-2">Version 1.0.0 - Launch</h3>
                    <div className="text-sm space-y-1">
                        <p className="font-bold text-green-700">✨ New Features:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>Kingdom building and upgrading system</li>
                            <li>Gold Mine with 25 levels of progression</li>
                            <li>Barracks for training attack, defense, spy, and sentry units</li>
                            <li>Battle system with espionage mechanics</li>
                            <li>Vault storage for protecting resources</li>
                            <li>Armoury for weapon upgrades</li>
                            <li>Library for research and upgrades</li>
                            <li>Seasonal competition system</li>
                            <li>Real-time chat and messaging</li>
                            <li>Admin panel for game management</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
