import React from 'react';

export default function Help() {
    return (
        <div className="p-4 bg-white min-w-[500px] h-full">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">❓ Help & Getting Started</h2>

            <div className="space-y-3 text-sm">
                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold mb-2">🚀 Getting Started:</h3>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Register for a free account</li>
                        <li>Choose your kingdom name</li>
                        <li>Start building your kingdom and training citizens</li>
                        <li>Upgrade your Gold Mine to increase income</li>
                        <li>Train soldiers in the Barracks</li>
                        <li>Attack other players to gain resources and rank</li>
                    </ol>
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold mb-2">💡 Tips for Success:</h3>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong>Balance your economy:</strong> Upgrade your Gold Mine early</li>
                        <li><strong>Protect your resources:</strong> Use the Vault to store gold safely</li>
                        <li><strong>Scout before attacking:</strong> Send spies to gather intelligence</li>
                        <li><strong>Upgrade weapons:</strong> Visit the Armoury to boost army strength</li>
                        <li><strong>Research wisely:</strong> Library upgrades provide permanent bonuses</li>
                        <li><strong>Stay active:</strong> Log in regularly to collect resources and turns</li>
                    </ul>
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold mb-2">📞 Need More Help?</h3>
                    <p>
                        Use the in-game chat to ask questions or seek advice from experienced players.
                        The Kingdom Architect community is here to help!
                    </p>
                </div>
            </div>
        </div>
    );
}
