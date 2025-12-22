import React from 'react';

export default function About() {
    return (
        <div className="p-4 bg-white min-w-[500px] h-full">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">ℹ️ About Kingdom Architect</h2>

            <div className="space-y-3 text-sm">
                <p>
                    <strong>Kingdom Architect</strong> is a browser-based strategy game inspired by classic
                    kingdom-building games of the late 90s and early 2000s.
                </p>

                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold mb-2">🎮 Game Features:</h3>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Build and upgrade your kingdom</li>
                        <li>Train armies and develop military strategies</li>
                        <li>Research technologies in the Library</li>
                        <li>Spy on enemies and defend against attacks</li>
                        <li>Compete in seasonal rankings</li>
                        <li>Chat with other players</li>
                    </ul>
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold mb-2">🏆 Objective:</h3>
                    <p>
                        Build the most powerful kingdom by managing resources, training armies, and
                        strategically attacking or defending against other players. Rise through the
                        ranks to become the ultimate Kingdom Architect!
                    </p>
                </div>

                <p className="text-center text-gray-600 mt-4">
                    © 2025 Kingdom Architect. All rights reserved.
                </p>
            </div>
        </div>
    );
}
