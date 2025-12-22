import React from 'react';
import Minesweeper from './Minesweeper';
import Solitaire from './Solitaire';

export default function GamesWindow({ onNavigate, initialGame }) {
    const [selectedGame, setSelectedGame] = React.useState(initialGame || null);

    React.useEffect(() => {
        if (initialGame) setSelectedGame(initialGame);
    }, [initialGame]);

    if (selectedGame === 'minesweeper') {
        return (
            <div className="h-full flex flex-col">
                <div className="bg-[#c0c0c0] p-1 border-b border-white mb-2">
                    <button
                        onClick={() => setSelectedGame(null)}
                        className="px-2 py-0 border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white text-xs"
                    >
                        &lt; Back to Games
                    </button>
                </div>
                <Minesweeper />
            </div>
        );
    }

    if (selectedGame === 'solitaire') {
        return (
            <div className="h-full flex flex-col">
                <div className="bg-[#c0c0c0] p-1 border-b border-white mb-2">
                    <button
                        onClick={() => setSelectedGame(null)}
                        className="px-2 py-0 border-2 border-white border-r-gray-600 border-b-gray-600 active:border-gray-600 active:border-r-white active:border-b-white text-xs"
                    >
                        &lt; Back to Games
                    </button>
                </div>
                <Solitaire />
            </div>
        );
    }

    return (
        <div className="bg-white p-4 h-full">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-gray-300">Select a Game</h2>
            <div className="grid grid-cols-4 gap-4">
                <div
                    className="flex flex-col items-center justify-center p-4 hover:bg-blue-100 cursor-pointer border border-transparent hover:border-blue-300 rounded"
                    onClick={() => setSelectedGame('minesweeper')}
                >
                    <div className="text-4xl mb-2">💣</div>
                    <span className="text-sm font-bold">Minesweeper</span>
                </div>

                {/* Placeholder for future games */}
                <div
                    className="flex flex-col items-center justify-center p-4 hover:bg-blue-100 cursor-pointer border border-transparent hover:border-blue-300 rounded"
                    onClick={() => setSelectedGame('solitaire')}
                >
                    <div className="text-4xl mb-2">♠️</div>
                    <span className="text-sm">Solitaire</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 opacity-50 grayscale cursor-not-allowed">
                    <div className="text-4xl mb-2">❤️</div>
                    <span className="text-sm">Hearts</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 opacity-50 grayscale cursor-not-allowed">
                    <div className="text-4xl mb-2">🧱</div>
                    <span className="text-sm">Tetris</span>
                </div>
            </div>
        </div>
    );
}
