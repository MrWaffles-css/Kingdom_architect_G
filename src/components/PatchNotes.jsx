import React from 'react';

export default function PatchNotes() {
    return (
        <div className="p-4 bg-white min-w-[500px] h-full">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">📋 Patch Notes</h2>

            <div className="space-y-4">
                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold text-blue-800 mb-2">Version 1.5 - Economy &amp; QoL</h3>
                    <div className="text-sm space-y-1">
                        <p className="font-bold text-green-700">✨ New Features &amp; Fixes:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                            <li><strong>Balance:</strong> Bandit Leader stats reduced (10k → 1k).</li>
                            <li><strong>Economy:</strong> Miner training cost reduced (2000g → 1000g).</li>
                            <li><strong>Armoury:</strong> Added "MAX" buy button and Sell confirmation modal.</li>
                            <li><strong>Economy Fixes:</strong> Fixed bug preventing Vault gold from being used for building upgrades.</li>
                            <li><strong>Gold Overflow:</strong> Attack winnings now overfill the Vault (this pauses passive income until drained).</li>
                            <li><strong>Gold Generation:</strong> Fixed an issue where passive gold generation was paused.</li>
                            <li><strong>Boss Raids:</strong> Added "Defeated" counter to track boss kills.</li>
                            <li><strong>Armoury:</strong> Added summary bar to see equipped/unequipped soldiers at a glance.</li>
                            <li><strong>Stats:</strong> Fixed instant stat updates when buying weapons.</li>
                        </ul>
                    </div>
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50 opacity-75">
                    <h3 className="font-bold text-gray-700 mb-2">Version 1.0.0 - Launch</h3>
                    <div className="text-sm space-y-1">
                        <p className="font-bold text-gray-600">✨ Launch Features:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                            <li>Kingdom building and upgrading system</li>
                            <li>Gold Mine, Barracks, Vault, Armoury, Library</li>
                            <li>Battlefield, Espionage, Seasons, Chat</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
