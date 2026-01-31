import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../contexts/GameContext';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 }; // Moving up
const NORMAL_SPEED = 150;
const HARD_INITIAL_SPEED = 150;
const HARD_SPEED_DECREASE = 5; // Speed increases (interval decreases) by this amount per food
const MIN_SPEED = 50; // Fastest possible speed

export default function Snake({ session, stats }) {
    const { isAdmin } = useGame();
    const [difficulty, setDifficulty] = useState('normal'); // 'normal' or 'hard'
    const [gameStarted, setGameStarted] = useState(false);
    const [snake, setSnake] = useState(INITIAL_SNAKE);
    const [food, setFood] = useState({ x: 5, y: 5 });
    const [direction, setDirection] = useState(INITIAL_DIRECTION);
    const [gameOver, setGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [gameSpeed, setGameSpeed] = useState(NORMAL_SPEED);

    // Use refs for values that change frequently to avoid stale closures in interval
    const snakeRef = useRef(snake);
    const directionRef = useRef(direction);
    const gameOverRef = useRef(gameOver);
    const isPausedRef = useRef(isPaused);
    const gameSpeedRef = useRef(gameSpeed);

    // Keep refs in sync
    useEffect(() => { snakeRef.current = snake; }, [snake]);
    useEffect(() => { directionRef.current = direction; }, [direction]);
    useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);

    // Leaderboard management (top 10 scores per mode)
    const getLeaderboard = (mode) => {
        const key = `snake_leaderboard_${mode}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    };

    const updateLeaderboard = (mode, newScore, playerName) => {
        const key = `snake_leaderboard_${mode}`;
        let leaderboard = getLeaderboard(mode);

        // Check if player already has a score
        const existingEntry = leaderboard.find(entry => entry.username === playerName);

        // Only update if new score is better (higher) than existing score
        if (existingEntry && newScore <= existingEntry.score) {
            console.log('New score is not better than existing best score');
            return leaderboard; // Return unchanged leaderboard
        }

        // Remove any existing entries for this player
        leaderboard = leaderboard.filter(entry => entry.username !== playerName);

        // Add the new score
        leaderboard.push({
            score: newScore,
            username: playerName,
            date: new Date().toISOString()
        });

        // Sort by score descending and keep top 10
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10);

        localStorage.setItem(key, JSON.stringify(leaderboard));
        return leaderboard;
    };

    const [normalLeaderboard, setNormalLeaderboard] = useState(getLeaderboard('normal'));
    const [hardLeaderboard, setHardLeaderboard] = useState(getLeaderboard('hard'));
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    const generateFood = useCallback((currentSnake) => {
        let newFood;
        let isOnSnake;
        do {
            newFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
            isOnSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
        } while (isOnSnake);
        return newFood;
    }, []);

    const startGame = (selectedDifficulty) => {
        setDifficulty(selectedDifficulty);
        setGameStarted(true);
        setSnake(INITIAL_SNAKE);
        setDirection(INITIAL_DIRECTION);
        setGameOver(false);
        setScore(0);
        setIsPaused(false);
        setFood(generateFood(INITIAL_SNAKE));
        setGameSpeed(selectedDifficulty === 'hard' ? HARD_INITIAL_SPEED : NORMAL_SPEED);
    };

    const resetGame = () => {
        setGameStarted(false);
        setSnake(INITIAL_SNAKE);
        setDirection(INITIAL_DIRECTION);
        setGameOver(false);
        setScore(0);
        setIsPaused(false);
        setFood(generateFood(INITIAL_SNAKE));
        setGameSpeed(NORMAL_SPEED);
    };

    const handleKeyDown = useCallback((e) => {
        if (gameOverRef.current || !gameStarted) return;

        // Prevent default scrolling for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === ' ' || e.key === 'Escape') {
            setIsPaused(prev => !prev);
            return;
        }

        if (isPausedRef.current) return;

        const currentDir = directionRef.current;

        switch (e.key) {
            case 'ArrowUp':
                if (currentDir.y !== 1) setDirection({ x: 0, y: -1 });
                break;
            case 'ArrowDown':
                if (currentDir.y !== -1) setDirection({ x: 0, y: 1 });
                break;
            case 'ArrowLeft':
                if (currentDir.x !== 1) setDirection({ x: -1, y: 0 });
                break;
            case 'ArrowRight':
                if (currentDir.x !== -1) setDirection({ x: 1, y: 0 });
                break;
        }
    }, [gameStarted]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (!gameStarted) return;

        const moveSnake = () => {
            if (gameOverRef.current || isPausedRef.current) return;

            const currentSnake = snakeRef.current;
            const currentDir = directionRef.current;
            const head = currentSnake[0];
            const newHead = { x: head.x + currentDir.x, y: head.y + currentDir.y };

            // Check walls
            if (
                newHead.x < 0 ||
                newHead.x >= GRID_SIZE ||
                newHead.y < 0 ||
                newHead.y >= GRID_SIZE
            ) {
                setGameOver(true);
                return;
            }

            // Check self collision
            if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
                setGameOver(true);
                return;
            }

            const newSnake = [newHead, ...currentSnake];

            // Check food
            if (newHead.x === food.x && newHead.y === food.y) {
                setScore(s => s + 1);
                setFood(generateFood(newSnake));

                // In hard mode, increase speed with each food
                if (difficulty === 'hard') {
                    setGameSpeed(prevSpeed => Math.max(MIN_SPEED, prevSpeed - HARD_SPEED_DECREASE));
                }
                // Don't pop tail, so snake grows
            } else {
                newSnake.pop(); // Remove tail
            }

            setSnake(newSnake);
        };

        const gameInterval = setInterval(moveSnake, gameSpeedRef.current);
        return () => clearInterval(gameInterval);
    }, [food, generateFood, gameStarted, difficulty, gameSpeed]);

    // Add score to leaderboard when game ends
    useEffect(() => {
        if (gameOver && score > 0) {
            // Automatically use username from stats or session
            const playerName = stats?.username || session?.user?.email?.split('@')[0] || 'Player';
            const newLeaderboard = updateLeaderboard(difficulty, score, playerName);

            if (difficulty === 'normal') {
                setNormalLeaderboard(newLeaderboard);
            } else {
                setHardLeaderboard(newLeaderboard);
            }
        }
    }, [gameOver, score, difficulty, stats, session]);

    const handleResetLeaderboard = (mode) => {
        if (window.confirm(`Are you sure you want to reset the ${mode.toUpperCase()} mode leaderboard? This action cannot be undone!`)) {
            const key = `snake_leaderboard_${mode}`;
            localStorage.removeItem(key);

            if (mode === 'normal') {
                setNormalLeaderboard([]);
            } else {
                setHardLeaderboard([]);
            }

            alert(`${mode.toUpperCase()} mode leaderboard has been reset.`);
        }
    };

    if (!gameStarted) {
        return (
            <div className="flex items-center justify-center h-full bg-[#202020] text-white p-4 font-mono select-none">
                <div className="flex gap-8">
                    {/* Difficulty Selection */}
                    <div className="bg-gray-800 p-6 rounded-lg border-2 border-gray-600 shadow-xl">
                        <h2 className="text-2xl font-bold mb-6 text-center text-green-400">Select Difficulty</h2>
                        <div className="space-y-4">
                            <button
                                onClick={() => startGame('normal')}
                                className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-lg transform transition hover:scale-105"
                            >
                                <div className="text-xl">Normal Mode</div>
                                <div className="text-xs mt-1 opacity-75">Classic snake gameplay</div>
                            </button>
                            <button
                                onClick={() => startGame('hard')}
                                className="w-full px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transform transition hover:scale-105"
                            >
                                <div className="text-xl">Hard Mode 🔥</div>
                                <div className="text-xs mt-1 opacity-75">Speed increases with each food!</div>
                            </button>
                        </div>
                    </div>

                    {/* Leaderboards */}
                    <div className="flex gap-4">
                        <LeaderboardPanel
                            title="Normal Mode"
                            leaderboard={normalLeaderboard}
                            isAdmin={isAdmin}
                            onReset={() => handleResetLeaderboard('normal')}
                        />
                        <LeaderboardPanel
                            title="Hard Mode"
                            leaderboard={hardLeaderboard}
                            isAdmin={isAdmin}
                            onReset={() => handleResetLeaderboard('hard')}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-full bg-[#202020] text-white p-4 font-mono select-none gap-6">
            <div className="flex flex-col items-center">
                <div className="mb-4 flex justify-between w-full max-w-[400px] gap-4">
                    <div className="bg-gray-800 p-2 rounded border border-gray-600">
                        Score: {score}
                    </div>
                    <div className={`p-2 rounded border ${difficulty === 'hard' ? 'bg-red-900 border-red-600' : 'bg-blue-900 border-blue-600'}`}>
                        {difficulty === 'hard' ? '🔥 HARD' : 'NORMAL'}
                    </div>
                    {difficulty === 'hard' && (
                        <div className="bg-gray-800 p-2 rounded border border-gray-600 text-xs">
                            Speed: {Math.round((1000 / gameSpeed) * 10) / 10}/s
                        </div>
                    )}
                </div>

                <div
                    className="relative bg-black border-4 border-gray-600 shadow-xl"
                    style={{
                        width: '400px',
                        height: '400px',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                        gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`
                    }}
                >
                    {/* Overlay for Game Over / Pause */}
                    {(gameOver || isPaused) && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
                            {gameOver ? (
                                <>
                                    <h2 className="text-red-500 text-4xl font-bold mb-2">GAME OVER</h2>
                                    <div className="text-2xl mb-4">Score: {score}</div>
                                    <button
                                        onClick={resetGame}
                                        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg transform transition hover:scale-105"
                                    >
                                        Back to Menu
                                    </button>
                                </>
                            ) : (
                                <h2 className="text-white text-4xl font-bold animate-pulse">PAUSED</h2>
                            )}
                        </div>
                    )}

                    {/* Render Grid Cells */}
                    {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                        const x = index % GRID_SIZE;
                        const y = Math.floor(index / GRID_SIZE);

                        const isSnakeHead = snake[0].x === x && snake[0].y === y;
                        const isSnakeBody = snake.some((s, i) => i !== 0 && s.x === x && s.y === y);
                        const isFood = food.x === x && food.y === y;

                        let className = "w-full h-full border border-white/5 ";
                        if (isSnakeHead) className += difficulty === 'hard' ? "bg-red-400 rounded-sm z-10" : "bg-green-400 rounded-sm z-10";
                        else if (isSnakeBody) className += difficulty === 'hard' ? "bg-red-600 rounded-sm" : "bg-green-600 rounded-sm";
                        else if (isFood) className += "bg-yellow-400 rounded-full scale-75 shadow-[0_0_10px_yellow]";

                        return <div key={index} className={className}></div>;
                    })}
                </div>

                <div className="mt-4 text-gray-400 text-xs text-center">
                    Use Arrow Keys to move • Space to Pause
                </div>
            </div>


            {/* Leaderboard Toggle */}
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 rounded text-white text-sm font-bold"
                >
                    {showLeaderboard ? 'Hide Scores' : 'Best Scores'}
                </button>

                {showLeaderboard && (
                    <div className="bg-gray-800 p-3 border-2 border-gray-600 rounded w-56 text-xs">
                        <div className="font-bold mb-2 text-center border-b border-gray-500 pb-1 text-yellow-400">
                            {difficulty === 'hard' ? 'HARD' : 'NORMAL'} MODE TOP 10
                        </div>
                        {(difficulty === 'hard' ? hardLeaderboard : normalLeaderboard).length === 0 ? (
                            <div className="text-center italic text-gray-500">No records yet.</div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-gray-400">
                                        <th className="font-normal w-6">#</th>
                                        <th className="font-normal">Name</th>
                                        <th className="font-normal text-right">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(difficulty === 'hard' ? hardLeaderboard : normalLeaderboard).map((entry, i) => (
                                        <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-700/30'}>
                                            <td className="w-6">{i + 1}.</td>
                                            <td className="truncate max-w-[100px]" title={entry.username}>{entry.username}</td>
                                            <td className="text-right text-green-400 font-mono font-bold">{entry.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}

function LeaderboardPanel({ title, leaderboard, isAdmin, onReset }) {
    return (
        <div className="bg-gray-800 p-4 rounded-lg border-2 border-gray-600 shadow-xl min-w-[220px]">
            <h3 className="text-lg font-bold mb-3 text-center text-yellow-400">{title} Top 10</h3>
            {leaderboard.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4">No scores yet</div>
            ) : (
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-600">
                            <th className="font-normal w-6 pb-1">#</th>
                            <th className="font-normal pb-1">Name</th>
                            <th className="font-normal text-right pb-1">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.map((entry, i) => (
                            <tr key={i} className={`${i % 2 === 0 ? 'bg-gray-700/20' : ''} ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>
                                <td className="w-6 py-1">{i + 1}.</td>
                                <td className="truncate max-w-[120px] py-1" title={entry.username}>
                                    {i === 0 && '👑 '}{entry.username}
                                </td>
                                <td className="text-right font-mono font-bold py-1">{entry.score}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {isAdmin && (
                <button
                    onClick={onReset}
                    className="mt-3 w-full px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow transform transition hover:scale-105"
                    title="Admin: Reset this leaderboard"
                >
                    🔒 Reset Leaderboard
                </button>
            )}
        </div>
    );
}
