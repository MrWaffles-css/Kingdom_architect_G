import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';

const SoundContext = createContext();

export function useSound() {
    return useContext(SoundContext);
}

export function SoundProvider({ children }) {
    // We modify the internal play function to carry some state if needed, 
    // but for simple SFX, creating new Audio objects is usually fine for low frequency checks.
    // Optimally, we can preload them.

    const sounds = useRef({
        click: new Audio('data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='), // Placeholder, will replace with real base64 below
        startup: null, // Will load on demand or replace
        error: null,
        hover: null
    });

    // Real Base64 Data for sounds
    // Short mechanical click
    const CLICK_SFX = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACQB/8H/wf/B/8H/wf/B/8H/wcBAAAAAQ==";

    // Windows-like navigation start
    const START_SFX = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; // Placeholder for now

    const playSound = useCallback((type) => {
        try {
            let src = '';
            switch (type) {
                case 'click':
                    // A simple click sound
                    // Using a very short beep/click for now or the actual win98 click if available
                    // Let's use a generated beep for click to save space, or a real small clear one.
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);

                    oscillator.type = 'square';
                    oscillator.frequency.value = 800; // Click freq
                    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.05);

                    oscillator.start();
                    oscillator.stop(audioCtx.currentTime + 0.05);
                    return;
                case 'hover':
                    // Faint tick
                    return;
                case 'error':
                    // Windows Chord-like sound using oscillator
                    const errCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const errOsc = errCtx.createOscillator();
                    const errGain = errCtx.createGain();
                    errOsc.connect(errGain);
                    errGain.connect(errCtx.destination);
                    errOsc.type = 'sawtooth';
                    errOsc.frequency.value = 150;
                    errGain.gain.setValueAtTime(0.2, errCtx.currentTime);
                    errGain.gain.exponentialRampToValueAtTime(0.01, errCtx.currentTime + 0.5);
                    errOsc.start();
                    errOsc.stop(errCtx.currentTime + 0.5);
                    return;
                default:
                    return;
            }
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }, []);

    const playStartupSound = useCallback(() => {
        // Simulating the Windows 98 startup sound with Web Audio API for better experience/no file dependency
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;

            // Chord: C3, G3, C4
            const notes = [130.81, 196.00, 261.63, 392.00, 523.25];

            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine'; // deeply rich sine/triangle hybrid would be better but sine is clean
                if (i > 2) osc.type = 'triangle'; // Add some harmonics for the higher notes

                osc.frequency.setValueAtTime(freq, t + i * 0.1); // Stagger start slightly

                // Envelope
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.15, t + 0.5 + i * 0.1); // Fade in
                gain.gain.exponentialRampToValueAtTime(0.001, t + 4.5); // Long fade out

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + 5);
            });

            // Add a "shimmer" effect
            const shimmer = ctx.createOscillator();
            const sGain = ctx.createGain();
            shimmer.type = 'sawtooth';
            shimmer.frequency.value = 2000;
            sGain.gain.setValueAtTime(0, t);
            sGain.gain.linearRampToValueAtTime(0.02, t + 1);
            sGain.gain.linearRampToValueAtTime(0, t + 3);
            shimmer.connect(sGain);
            sGain.connect(ctx.destination);
            shimmer.start(t);
            shimmer.stop(t + 3);

        } catch (e) {
            console.error("Startup sound failed", e);
        }
    }, []);

    // Global Keyboard Sound Listener
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Ignore if modifier keys are held down solely? No, any key press makes sound.
            // Maybe ignore repeated keys (held down) to avoid machine gun sound?
            if (e.repeat) return;

            // Simulated Mechanical Key Click
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();

                // 1. The "Thock" (Low frequency body)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.frequency.value = 200 + Math.random() * 50; // Slight variation
                osc.type = 'triangle';

                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start();
                osc.stop(ctx.currentTime + 0.05);

                // 2. The "Click" (High frequency tick)
                const clickOsc = ctx.createOscillator();
                const clickGain = ctx.createGain();

                clickOsc.frequency.value = 2000 + Math.random() * 200;
                clickOsc.type = 'square';

                clickGain.gain.setValueAtTime(0.05, ctx.currentTime);
                clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

                clickOsc.connect(clickGain);
                clickGain.connect(ctx.destination);

                clickOsc.start();
                clickOsc.stop(ctx.currentTime + 0.02);

            } catch (error) {
                // Ignore audio errors
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Global Click Sound Listener
    useEffect(() => {
        const handleGlobalClick = () => {
            playSound('click');
        };

        window.addEventListener('mousedown', handleGlobalClick);
        return () => window.removeEventListener('mousedown', handleGlobalClick);
    }, [playSound]);

    const playDialUpSound = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;

            // 1. Dialing (DTMF fast)
            for (let i = 0; i < 8; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = 600 + Math.random() * 500;
                osc.type = 'square';
                gain.gain.setValueAtTime(0.1, t + i * 0.1);
                gain.gain.setValueAtTime(0, t + i * 0.1 + 0.05);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.1);
                osc.stop(t + i * 0.1 + 0.05);
            }

            // 2. Handshake (The famous screech)
            // Carrier tone 1
            const carrier = ctx.createOscillator();
            const cGain = ctx.createGain();
            carrier.frequency.value = 2100;
            cGain.gain.setValueAtTime(0, t + 1.0);
            cGain.gain.linearRampToValueAtTime(0.1, t + 1.1);
            cGain.gain.setValueAtTime(0, t + 2.5);
            carrier.connect(cGain);
            cGain.connect(ctx.destination);
            carrier.start(t + 1.0);
            carrier.stop(t + 2.5);

            // White Noise (Static)
            const bufferSize = ctx.sampleRate * 2.0; // 2 seconds
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0, t + 2.0);
            nGain.gain.linearRampToValueAtTime(0.05, t + 2.2);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 4.0);
            noise.connect(nGain);
            nGain.connect(ctx.destination);
            noise.start(t + 2.0);

            // V.90 handshake tones
            const v90 = ctx.createOscillator();
            const vGain = ctx.createGain();
            v90.frequency.value = 1800; // Handshake freq
            v90.type = 'sawtooth'; // Gritty

            // Modulate pitch slightly to simulate negotiation
            v90.frequency.setValueAtTime(1800, t + 2.0);
            v90.frequency.linearRampToValueAtTime(2200, t + 2.5);
            v90.frequency.linearRampToValueAtTime(1200, t + 3.0);

            vGain.gain.setValueAtTime(0, t + 2.0);
            vGain.gain.linearRampToValueAtTime(0.1, t + 2.2);
            vGain.gain.linearRampToValueAtTime(0, t + 4.0);

            v90.connect(vGain);
            vGain.connect(ctx.destination);
            v90.start(t + 2.0);
            v90.stop(t + 4.0);

        } catch (e) {
            console.error("Dialup sound failed", e);
        }
    }, []);

    const value = {
        playSound,
        playStartupSound,
        playDialUpSound
    };

    return (
        <SoundContext.Provider value={value}>
            {children}
        </SoundContext.Provider>
    );
}
