import React, { useState, useEffect, useRef } from 'react';
import { getSpotifyAuthUrl, getSpotifyToken, removeHash } from '../config/spotify';

export default function CDPlayer({ onClose }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(0);
    const [trackTime, setTrackTime] = useState(0);
    const [showVisualizer, setShowVisualizer] = useState(true); // Default to visualizer as user likes it, or standard display? Real one is standard. I'll make standard default but toggleable. Actually user asked for "identical". Identical means NO visualizer by default. But they specifically asked for it earlier. I will make text overlay the visualizer.

    // Spotify State
    const [isSpotifyMode, setIsSpotifyMode] = useState(false);
    const [spotifyToken, setSpotifyToken] = useState(null);
    const [spotifyTrack, setSpotifyTrack] = useState(null);

    const audioRef = useRef(new Audio());
    const sourceNodeRef = useRef(null);

    // Audio Refs
    const canvasRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);
    const sequencerRef = useRef(null);
    const spotifyPollerRef = useRef(null);

    const builtinTracks = [
        {
            name: "Enthusiast",
            duration: 258,
            artist: "Tours",
            url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Tours/Enthusiast/Tours_-_01_-_Enthusiast.mp3"
        },
        {
            name: "Sentinel",
            duration: 212,
            artist: "Kai Engel",
            url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Kai_Engel/Satin/Kai_Engel_-_04_-_Sentinel.mp3"
        },
        {
            name: "Night Owl (Jakarta Style)",
            duration: 280,
            artist: "Broke For Free",
            // Placeholder for Jakarta
            url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/WFMU/Broke_For_Free/Directionless_EP/Broke_For_Free_-_01_-_Night_Owl.mp3"
        }
    ];

    // Auth Check on Mount
    useEffect(() => {
        // Init Audio Ref props
        audioRef.current.crossOrigin = "anonymous";

        const token = getSpotifyToken();
        if (token) {
            setSpotifyToken(token);
            setIsSpotifyMode(true);
            removeHash();
            // Start polling
            startSpotifyPolling(token);
        }
        return () => {
            stopAudio();
            stopSpotifyPolling();
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    // --- Built-in Audio Logic ---
    const initAudio = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioCtxRef.current.createAnalyser();
            analyserRef.current.fftSize = 256; // Higher res for real audio

            // Connect Audio Element to Web Audio API
            if (!sourceNodeRef.current) {
                audioRef.current.crossOrigin = "anonymous";
                sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
                sourceNodeRef.current.connect(analyserRef.current);
                analyserRef.current.connect(audioCtxRef.current.destination);
            }
        }
    };

    const playNote = (freq, type = 'sawtooth', duration = 0.2) => {
        if (!audioCtxRef.current) return;
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
        osc.connect(gain);
        gain.connect(analyserRef.current);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + duration);
    };

    const startSequencer = () => {
        if (sequencerRef.current) clearInterval(sequencerRef.current);
        let step = 0;

        // Music Patterns for "Free Tracks"
        const patterns = [
            // Track 1: Resonance (Original)
            {
                bass: [65.41, 65.41, 73.42, 65.41, 55.00, 55.00, 65.41, 73.42],
                melody: [261.63, 0, 329.63, 0, 392.00, 329.63, 0, 261.63],
                tempo: 250,
                type: 'sawtooth'
            },
            // Track 2: Neon Nights (Faster, Arpeggio)
            {
                bass: [43.65, 43.65, 49.00, 49.00, 55.00, 55.00, 65.41, 65.41],
                melody: [174.61, 220.00, 261.63, 220.00, 174.61, 261.63, 329.63, 261.63],
                tempo: 180,
                type: 'square'
            },
            // Track 3: Cyber City (Slow, Minor)
            {
                bass: [32.70, 0, 32.70, 0, 38.89, 0, 29.14, 0],
                melody: [130.81, 155.56, 196.00, 155.56, 130.81, 0, 0, 0],
                tempo: 400,
                type: 'triangle'
            }
        ];

        const pattern = patterns[currentTrack] || patterns[0];

        sequencerRef.current = setInterval(() => {
            setTrackTime(prev => prev + (pattern.tempo / 1000));

            // Bass
            if (step % 2 === 0) playNote(pattern.bass[Math.floor(step / 2) % pattern.bass.length], 'square', 0.4);

            // Melody
            const note = pattern.melody[step % pattern.melody.length];
            if (note > 0) playNote(note, pattern.type, 0.3);

            // Percussion (Noise)
            if (step % 4 === 0) playNote(1000 + Math.random() * 500, 'sawtooth', 0.05);

            step++;
        }, pattern.tempo);
    };

    const stopAudio = () => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setIsPlaying(false);
    };

    const toggleBuiltinPlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        } else {
            initAudio();
            if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

            // Load track if needed
            if (!audioRef.current.src || audioRef.current.src !== builtinTracks[currentTrack].url) {
                audioRef.current.src = builtinTracks[currentTrack].url;
            }

            audioRef.current.play()
                .then(() => {
                    setIsPlaying(true);
                    drawVisualizer();
                })
                .catch(e => console.error("Playback failed", e));
        }
    };

    // Watch for track changes to restart sequencer if playing
    useEffect(() => {
        if (!isSpotifyMode) {
            const wasPlaying = isPlaying;
            audioRef.current.pause();
            audioRef.current.src = builtinTracks[currentTrack].url;
            audioRef.current.currentTime = 0;

            if (wasPlaying) {
                audioRef.current.play()
                    .catch(e => console.error("Track change playback failed", e));
            }
        }
    }, [currentTrack]);

    // Sync time
    useEffect(() => {
        const updateTime = () => setTrackTime(audioRef.current.currentTime);
        audioRef.current.addEventListener('timeupdate', updateTime);
        audioRef.current.addEventListener('ended', handleNext); // Auto-advance

        return () => {
            audioRef.current.removeEventListener('timeupdate', updateTime);
            audioRef.current.removeEventListener('ended', handleNext);
        };
    }, [currentTrack]);

    const drawVisualizer = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Settings for Rainbow Visualizer
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        const render = () => {
            animationRef.current = requestAnimationFrame(render);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Clear with semi-transparent black for trail effect (optional, strictly black for now)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            x = 0;
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;

                // Rainbow Gradient Logic based on frequency index
                // Low Freq (Bass) -> Blue/Purple
                // Mid Freq (Mids) -> Green/Yellow
                // High Freq (Treble) -> Red

                const hue = (i / bufferLength) * 300 + 200; // Shift hue spectrum
                // Or simplified manual coloring:
                const r = Math.min(255, (i / bufferLength) * 500);
                const g = Math.min(255, 255 - Math.abs((i / bufferLength) * 500 - 255));
                const b = Math.min(255, 255 - (i / bufferLength) * 255);

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

                // Classic Bars
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                // Peak Cap (White)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x, canvas.height - barHeight - 2, barWidth, 2);

                x += barWidth + 1;
            }
        };
        render();
    };


    // --- Spotify Logic ---
    const startSpotifyPolling = (token) => {
        if (spotifyPollerRef.current) clearInterval(spotifyPollerRef.current);

        const fetchState = async () => {
            try {
                const res = await fetch('https://api.spotify.com/v1/me/player', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.status === 204) {
                    console.log('No active Spotify device');
                    setSpotifyTrack(null); // Clear track if no active device
                    return;
                }
                const data = await res.json();
                if (data && data.item) {
                    setSpotifyTrack({
                        name: data.item.name,
                        artist: data.item.artists.map(a => a.name).join(', '),
                        duration: data.item.duration_ms / 1000,
                        position: data.progress_ms / 1000,
                        isPlaying: data.is_playing
                    });
                    setTrackTime(data.progress_ms / 1000); // Sync time
                    // Fake visualizer if playing
                    if (data.is_playing && !isPlaying) {
                        // Just start visualizer but NO audio if we want fake viz
                        // Actually easier to just not viz for Spotify to keep clean
                    }
                } else {
                    setSpotifyTrack(null); // Clear track if no item
                }
            } catch (e) {
                console.error('Spotify Poll Error', e);
                setSpotifyTrack(null); // Clear track on error
            }
        };

        fetchState();
        spotifyPollerRef.current = setInterval(fetchState, 3000);
    };

    const stopSpotifyPolling = () => {
        if (spotifyPollerRef.current) clearInterval(spotifyPollerRef.current);
    };

    const handleSpotifyControl = async (action) => {
        if (!spotifyToken) return;
        try {
            await fetch(`https://api.spotify.com/v1/me/player/${action}`, {
                method: action === 'next' || action === 'previous' ? 'POST' : 'PUT',
                headers: { 'Authorization': `Bearer ${spotifyToken}` }
            });
            // Update immediately-ish
            setTimeout(() => startSpotifyPolling(spotifyToken), 500);
        } catch (e) { console.error(e); }
    };


    // --- UI Helpers ---
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const activeTrack = isSpotifyMode && spotifyTrack ? spotifyTrack : builtinTracks[currentTrack];
    const displayTime = isSpotifyMode && spotifyTrack ? spotifyTrack.position : trackTime;
    const totalDuration = isSpotifyMode && spotifyTrack ? spotifyTrack.duration : activeTrack.duration;

    // Derived Play/Pause handler
    const handlePlayPause = () => {
        if (isSpotifyMode) {
            if (spotifyTrack?.isPlaying) handleSpotifyControl('pause');
            else handleSpotifyControl('play');
        } else {
            toggleBuiltinPlay();
        }
    };

    const handleNext = () => {
        if (isSpotifyMode) handleSpotifyControl('next');
        else setCurrentTrack(Math.min(builtinTracks.length - 1, currentTrack + 1));
    };

    const handlePrev = () => {
        if (isSpotifyMode) handleSpotifyControl('previous');
        else setCurrentTrack(Math.max(0, currentTrack - 1));
    };


    const Button = ({ children, onClick, className = "" }) => (
        <button
            onClick={onClick}
            className={`
                min-w-[30px] h-[26px] bg-[#c0c0c0] 
                border-2 border-white border-r-gray-600 border-b-gray-600 
                active:border-gray-600 active:border-r-white active:border-b-white active:translate-y-[1px]
                flex items-center justify-center font-bold text-gray-800 text-xs px-1
                ${className}
            `}
        >
            {children}
        </button>
    );

    return (
        <div className="bg-[#c0c0c0] w-full h-full flex flex-col font-sans text-[11px] select-none text-black">
            {/* Menu Bar */}
            <div className="flex gap-4 px-2 py-0.5 mb-1 justify-between">
                <div className="flex gap-4">
                    <span className="first-letter:underline cursor-pointer">D</span>isc
                    <span className="first-letter:underline cursor-pointer">V</span>iew
                    <span className="first-letter:underline cursor-pointer">O</span>ptions
                    <span className="first-letter:underline cursor-pointer">H</span>elp
                </div>
                {!isSpotifyMode ? (
                    <button
                        className="text-[9px] text-blue-800 hover:text-blue-600 font-bold"
                        onClick={() => window.location.href = getSpotifyAuthUrl()}
                    >
                        Connect Spotify
                    </button>
                ) : (
                    <button
                        className="text-[9px] text-green-800 hover:text-green-600 font-bold"
                        onClick={() => {
                            setIsSpotifyMode(false);
                            setSpotifyToken(null);
                            stopSpotifyPolling();
                        }}
                    >
                        Disconnect
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex px-3 pb-2 gap-3">

                {/* Left: Display Area */}
                <div className="flex flex-col gap-1 w-[180px]"> {/* Slightly wider for better balance */}
                    {/* The Black Box Display (LED) - Now Larger & Text Free */}
                    <div
                        className="bg-black border-2 border-gray-500 border-b-white border-r-white h-[80px] relative overflow-hidden cursor-pointer"
                        onClick={() => !isSpotifyMode && setShowVisualizer(!showVisualizer)}
                        title={isSpotifyMode ? "Visualizer disabled in Spotify Monitor Mode" : "Click to toggle visualizer"}
                    >
                        {/* Visualizer Layer */}
                        {!isSpotifyMode && (
                            <canvas
                                ref={canvasRef}
                                width={180}
                                height={80}
                                className={`absolute inset-0 w-full h-full ${showVisualizer ? 'opacity-100' : 'opacity-20'}`}
                            />
                        )}
                    </div>

                    {/* New Dedicated Display Row for Track/Time */}
                    <div className="bg-[#000000] border border-gray-500 border-b-white border-r-white px-2 py-1 flex items-center justify-between font-mono text-[#00ff00] text-lg">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#008000] font-sans font-bold">TRK</span>
                            <span>[{isSpotifyMode ? 1 : currentTrack + 1}]</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#008000] font-sans font-bold">TIME</span>
                            <span>{formatTime(displayTime)}</span>
                        </div>
                    </div>

                    {/* Status Text under display */}
                    <div className="flex justify-between text-gray-600 text-[10px] px-1">
                        <span>{isSpotifyMode ? 'REMOTE' : '<STEREO>'}</span>
                        <span>{isSpotifyMode ? 'Spotify' : 'Disc 1'}</span>
                    </div>
                </div>

                {/* Right: Controls Area */}
                <div className="flex flex-col justify-between flex-1 pt-1 h-[120px]"> {/* Matched height roughly */}
                    {/* Top Row: Play/Pause/Stop */}
                    <div className="flex gap-1 justify-start">
                        <Button onClick={handlePlayPause} className="w-[50px] font-bold">
                            {isSpotifyMode ? (spotifyTrack?.isPlaying ? "||" : "Play") : (isPlaying ? "||" : "Play")}
                        </Button>
                        <Button onClick={stopAudio} className="w-[50px]">Stop</Button>
                        <Button className="w-[50px]">Eject</Button>
                    </div>

                    {/* Middle Row: Skip */}
                    <div className="flex gap-1 justify-start mt-1">
                        <Button className="w-[30px]" onClick={handlePrev}>|&lt;&lt;</Button>
                        <Button className="w-[30px]">&lt;&lt;</Button>
                        <Button className="w-[30px]">&gt;&gt;</Button>
                        <Button className="w-[30px]" onClick={handleNext}>&gt;&gt;|</Button>
                    </div>

                    {/* Bottom Row: Loop/Random (Optional, mimicking spacing) */}
                    <div className="flex-1"></div>
                </div>
            </div>

            {/* Bottom Info Area: Artist/Title/Track */}
            <div className="px-3 pb-2 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="w-10 text-right">Artist:</span>
                    <div className="flex-1 bg-white border border-gray-600 border-r-gray-200 border-b-gray-200 px-1 py-[1px] shadow-inner text-black truncate">
                        {activeTrack.artist || 'Unknown'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-10 text-right">Title:</span>
                    <div className="flex-1 bg-white border border-gray-600 border-r-gray-200 border-b-gray-200 px-1 py-[1px] shadow-inner text-black truncate">
                        {activeTrack.name || 'Unknown'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-10 text-right">Track:</span>
                    <div className="flex-1 bg-white border border-gray-600 border-r-gray-200 border-b-gray-200 px-1 py-[1px] shadow-inner text-black truncate">
                        {activeTrack.name} - {formatTime(totalDuration)}
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className="border-t border-gray-400 mt-1 px-2 py-0.5 flex justify-between text-gray-600">
                <span>{isSpotifyMode ? 'Spotify Connected' : `Total Play: ${formatTime(builtinTracks.reduce((acc, t) => acc + t.duration, 0))} m:s`}</span>
                <span></span>
            </div>
        </div>
    );
}
