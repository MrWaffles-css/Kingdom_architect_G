import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { useGame } from '../contexts/GameContext';

const DIFFICULTIES = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
};

const CELL_SIZE = 24;

export default function Minesweeper() {
    const { session } = useGame();
    const [difficulty, setDifficulty] = useState('beginner');
    const [grid, setGrid] = useState([]);
    const [gameState, setGameState] = useState('new'); // new, playing, won, lost
    const [minesLeft, setMinesLeft] = useState(DIFFICULTIES.beginner.mines);
    const [time, setTime] = useState(0);
    const [mouseDown, setMouseDown] = useState(false);

    // Leaderboard State
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [leaderboardLoading, setLeaderboardLoading] = useState(false);

    // Initialize Game
    const initGame = useCallback((diff = difficulty) => {
        const { rows, cols, mines } = DIFFICULTIES[diff];
        const newGrid = [];

        // Create empty grid
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push({
                    row: r,
                    col: c,
                    isMine: false,
                    isOpen: false,
                    isFlagged: false,
                    neighborCount: 0
                });
            }
            newGrid.push(row);
        }

        // Place Mines
        let minesPlaced = 0;
        while (minesPlaced < mines) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);
            if (!newGrid[r][c].isMine) {
                newGrid[r][c].isMine = true;
                minesPlaced++;
            }
        }

        // Calculate Neighbors
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (newGrid[r][c].isMine) continue;
                let count = 0;
                directions.forEach(([dr, dc]) => {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newGrid[nr][nc].isMine) {
                        count++;
                    }
                });
                newGrid[r][c].neighborCount = count;
            }
        }

        setGrid(newGrid);
        setGameState('new');
        setMinesLeft(mines);
        setTime(0);
    }, [difficulty]);

    useEffect(() => {
        initGame();
    }, [initGame]);

    useEffect(() => {
        let timer;
        if (gameState === 'playing') {
            timer = setInterval(() => {
                setTime(t => Math.min(t + 1, 999));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    // Handle Victory submission
    useEffect(() => {
        if (gameState === 'won' && session?.user?.id) {
            submitScore(time);
        }
    }, [gameState, time, session?.user?.id]);

    const submitScore = async (scoreTime) => {
        try {
            await supabase.from('minesweeper_scores').insert({
                user_id: session.user.id,
                difficulty: difficulty,
                time_seconds: scoreTime
            });
            // Don't auto-open but refresh if open
            if (showLeaderboard) fetchLeaderboard();
        } catch (err) {
            console.error('Failed to submit score:', err);
        }
    };

    const fetchLeaderboard = useCallback(async () => {
        setLeaderboardLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_minesweeper_leaderboard', { p_difficulty: difficulty });
            if (error) throw error;
            setLeaderboard(data || []);
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setLeaderboardLoading(false);
        }
    }, [difficulty]);

    useEffect(() => {
        if (showLeaderboard) {
            fetchLeaderboard();
        }
    }, [showLeaderboard, fetchLeaderboard]);


    const handleCellClick = (r, c) => {
        if (gameState === 'won' || gameState === 'lost') return;
        if (grid[r][c].isFlagged || grid[r][c].isOpen) return;

        if (gameState === 'new') setGameState('playing');

        const newGrid = [...grid];
        const cell = newGrid[r][c];

        if (cell.isMine) {
            // Game Over
            cell.isOpen = true;
            revealAllMines(newGrid);
            setGameState('lost');
        } else {
            revealCell(newGrid, r, c);
            checkWin(newGrid);
        }
        setGrid(newGrid);
    };

    const handleRightClick = (e, r, c) => {
        e.preventDefault();
        if (gameState === 'won' || gameState === 'lost') return;
        if (grid[r][c].isOpen) return;

        if (gameState === 'new') setGameState('playing');

        const newGrid = [...grid];
        const cell = newGrid[r][c];

        if (!cell.isFlagged && minesLeft > 0) {
            cell.isFlagged = true;
            setMinesLeft(m => m - 1);
        } else if (cell.isFlagged) {
            cell.isFlagged = false;
            setMinesLeft(m => m + 1);
        }

        setGrid(newGrid);
    };

    const revealCell = (currentGrid, r, c) => {
        if (r < 0 || r >= currentGrid.length || c < 0 || c >= currentGrid[0].length) return;
        const cell = currentGrid[r][c];
        if (cell.isOpen || cell.isFlagged) return;

        cell.isOpen = true;

        if (cell.neighborCount === 0) {
            // Flood fill
            const directions = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];
            directions.forEach(([dr, dc]) => revealCell(currentGrid, r + dr, c + dc));
        }
    };

    const revealAllMines = (currentGrid) => {
        currentGrid.forEach(row => {
            row.forEach(cell => {
                if (cell.isMine) cell.isOpen = true;
            });
        });
    };

    const checkWin = (currentGrid) => {
        let openCount = 0;
        const totalCount = currentGrid.length * currentGrid[0].length;
        const totalMines = DIFFICULTIES[difficulty].mines;

        currentGrid.forEach(row => {
            row.forEach(cell => {
                if (cell.isOpen) openCount++;
            });
        });

        if (openCount === totalCount - totalMines) {
            // Wait to update state until next tick to ensure render is handled? No, logic is fine.
            setGameState('won');
            setMinesLeft(0);
            // Flag remaining mines visually
            currentGrid.forEach(row => {
                row.forEach(cell => {
                    if (cell.isMine) cell.isFlagged = true;
                });
            });
        }
    };

    const getSmiley = () => {
        if (gameState === 'won') return '😎';
        if (gameState === 'lost') return '😵';
        if (mouseDown) return '😮';
        return '🙂';
    };

    const getNumberColor = (num) => {
        switch (num) {
            case 1: return 'text-blue-700';
            case 2: return 'text-green-700';
            case 3: return 'text-red-700';
            case 4: return 'text-purple-900';
            case 5: return 'text-red-900';
            case 6: return 'text-teal-700';
            case 7: return 'text-black';
            case 8: return 'text-gray-600';
            default: return 'text-black';
        }
    };

    return (
        <div className="flex gap-4">
            <div className="bg-[#c0c0c0] p-1 flex flex-col items-center select-none font-bold">
                {/* Menu Bar Simulation */}
                <div className="w-full flex gap-4 text-xs mb-1 px-1">
                    <div className="cursor-pointer hover:bg-black hover:text-white px-1 relative group">
                        Game
                        <div className="absolute top-full left-0 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black shadow p-1 hidden group-hover:block z-20 w-32">
                            <div className="hover:bg-[#000080] hover:text-white px-2 cursor-pointer" onClick={() => initGame('beginner')}>Beginner</div>
                            <div className="hover:bg-[#000080] hover:text-white px-2 cursor-pointer" onClick={() => { setDifficulty('intermediate'); initGame('intermediate'); }}>Intermediate</div>
                            <div className="hover:bg-[#000080] hover:text-white px-2 cursor-pointer" onClick={() => { setDifficulty('expert'); initGame('expert'); }}>Expert</div>
                            <div className="border-t border-gray-400 my-1"></div>
                            <div className="hover:bg-[#000080] hover:text-white px-2 cursor-pointer" onClick={() => initGame()}>New Game</div>
                        </div>
                    </div>
                </div>

                {/* Header / HUD */}
                <div className="w-full bg-[#c0c0c0] border-[2px] border-gray-500 border-r-white border-b-white p-2 mb-2 flex justify-between items-center box-border"
                    style={{ borderStyle: 'inset' }}>

                    {/* Mine Counter */}
                    <div className="bg-black text-red-600 font-mono text-xl w-14 text-center border-t border-l border-gray-500 border-b-white border-r-white leading-none py-1">
                        {minesLeft.toString().padStart(3, '0')}
                    </div>

                    {/* Smiley Face Reset */}
                    <button
                        className="w-8 h-8 flex items-center justify-center text-lg bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white active:bg-gray-300 transform active:translate-y-[1px]"
                        onClick={() => initGame()}
                    >
                        {getSmiley()}
                    </button>

                    {/* Timer */}
                    <div className="bg-black text-red-600 font-mono text-xl w-14 text-center border-t border-l border-gray-500 border-b-white border-r-white leading-none py-1">
                        {time.toString().padStart(3, '0')}
                    </div>
                </div>

                {/* Grid */}
                <div className="border-4 border-gray-500 border-r-white border-b-white flex flex-col bg-gray-400"
                    onMouseDown={() => setMouseDown(true)}
                    onMouseUp={() => setMouseDown(false)}
                    onMouseLeave={() => setMouseDown(false)}
                >
                    {grid.map((row, rIndex) => (
                        <div key={rIndex} className="flex">
                            {row.map((cell, cIndex) => (
                                <div
                                    key={`${rIndex}-${cIndex}`}
                                    className={`w-6 h-6 flex items-center justify-center text-sm
                                     ${cell.isOpen
                                            ? 'border-[1px] border-gray-400'
                                            : 'border-2 border-white border-r-gray-500 border-b-gray-500 bg-[#c0c0c0] active:border-gray-500'}
                                 `}
                                    onClick={() => handleCellClick(rIndex, cIndex)}
                                    onContextMenu={(e) => handleRightClick(e, rIndex, cIndex)}
                                    style={{
                                        width: CELL_SIZE, height: CELL_SIZE
                                    }}
                                >
                                    {cell.isOpen ? (
                                        cell.isMine ? (
                                            gameState === 'lost' && grid[rIndex][cIndex] === cell ?
                                                <span className="bg-red-600 w-full h-full flex items-center justify-center">💣</span> :
                                                '💣'
                                        ) : (
                                            <span className={`font-black ${getNumberColor(cell.neighborCount)}`}>
                                                {cell.neighborCount > 0 ? cell.neighborCount : ''}
                                            </span>
                                        )
                                    ) : (
                                        cell.isFlagged ? '🚩' : ''
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="px-2 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs font-bold"
                >
                    {showLeaderboard ? 'Hide Scores' : 'Best Times'}
                </button>

                {showLeaderboard && (
                    <div className="bg-[#c0c0c0] p-2 border-2 border-white border-r-black border-b-black w-48 text-xs">
                        <div className="font-bold mb-2 text-center border-b border-gray-500 pb-1">
                            {difficulty.toUpperCase()} TOP 10
                        </div>
                        {leaderboardLoading ? (
                            <div className="text-center text-gray-500">Loading...</div>
                        ) : leaderboard.length === 0 ? (
                            <div className="text-center italic">No records yet.</div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-gray-600">
                                        <th className="font-normal w-6">#</th>
                                        <th className="font-normal">Name</th>
                                        <th className="font-normal text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((entry, i) => (
                                        <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-300/30'}>
                                            <td className="w-6">{i + 1}.</td>
                                            <td className="truncate max-w-[80px]" title={entry.username}>{entry.username}</td>
                                            <td className="text-right text-red-800 font-mono font-bold">{entry.time_seconds}</td>
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
