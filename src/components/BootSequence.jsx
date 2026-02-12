import React, { useState, useEffect } from 'react';
import { useSound } from '../contexts/SoundContext';

export default function BootSequence({ onComplete }) {
    const [lines, setLines] = useState([]);
    const [memoryTest, setMemoryTest] = useState(0);
    const [phase, setPhase] = useState('bios'); // bios, dos, complete

    const { playDialUpSound } = useSound();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                onComplete();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onComplete]);

    useEffect(() => {
        // Initial BIOS lines
        const biosLines = [
            "Kingdom Architect BIOS (C) 1998 Kingdom Systems Inc.",
            "BIOS Date 01/01/98 12:00:00 Ver: 1.0.2",
            "CPU: Intel Pentium II 400MHz",
            "64MB System RAM Checking..."
        ];

        let lineIdx = 0;
        const lineInterval = setInterval(() => {
            if (lineIdx < biosLines.length) {
                setLines(prev => [...prev, biosLines[lineIdx]]);
                lineIdx++;
            } else {
                clearInterval(lineInterval);
                // Start Memory Test
                const memInterval = setInterval(() => {
                    setMemoryTest(prev => {
                        const next = prev + 1024;
                        if (next >= 65536) {
                            clearInterval(memInterval);
                            setLines(prev => [...prev, "65536KB OK", " ", "Detecting Primary Master ... KA-HD-20GB", "Detecting Primary Slave ... None", "Detecting Secondary Master ... CD-ROM 52X", " "]);

                            setTimeout(() => {
                                setPhase('dos');
                                setLines([]);
                            }, 2000);

                            return 65536;
                        }
                        return next;
                    });
                }, 10);
            }
        }, 500);

        return () => {
            clearInterval(lineInterval);
        };
    }, []);

    useEffect(() => {
        if (phase === 'dos') {
            playDialUpSound();
            const dosLines = [
                "Starting Windows 98...",
                "C:\\> WIN",
                " "
            ];
            let lineIdx = 0;
            const lineInterval = setInterval(() => {
                if (lineIdx < dosLines.length) {
                    setLines(prev => [...prev, dosLines[lineIdx]]);
                    lineIdx++;
                } else {
                    clearInterval(lineInterval);
                    setTimeout(() => {
                        onComplete();
                    }, 1500);
                }
            }, 800);
            return () => clearInterval(lineInterval);
        }
    }, [phase, playDialUpSound]);

    return (
        <div
            className="fixed inset-0 bg-black text-gray-300 font-mono p-10 z-[200] cursor-pointer select-none overflow-hidden text-lg"
            onClick={onComplete}
            onTouchStart={onComplete}
        >
            {phase === 'bios' && (
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                        <span>Award Modular BIOS v4.51PG, An Energy Star Ally</span>
                    </div>
                    <span>Copyright (C) 1984-98, Award Software, Inc.</span>
                    <br />
                    {lines.map((line, i) => (
                        <div key={i}>{line.includes("Checking...") ? `64MB System RAM Checking : ${memoryTest}KB OK` : line}</div>
                    ))}
                    {lines.length >= 4 && memoryTest < 65536 && (
                        <div>64MB System RAM Checking : {memoryTest}KB</div>
                    )}

                    <div className="fixed bottom-10 left-10 text-gray-500 text-sm">
                        Press <strong>DEL</strong> to enter SETUP, <strong>ESC</strong> to skip
                    </div>
                </div>
            )}

            {phase === 'dos' && (
                <div className="flex flex-col gap-1">
                    {lines.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                    <div className="animate-pulse">_</div>
                </div>
            )}
        </div>
    );
}
