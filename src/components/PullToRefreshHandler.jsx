import React, { useEffect, useState, useRef } from 'react';

const PullToRefreshHandler = () => {
    const [distance, setDistance] = useState(0);
    const [loading, setLoading] = useState(false);

    // Refs to track state inside event listeners without dependency loops
    const startYRef = useRef(0);
    const distanceRef = useRef(0);
    const isPullingRef = useRef(false);
    const isValidStartRef = useRef(false);

    const THRESHOLD = 100; // Visual threshold to trigger
    const RESISTANCE = 0.4; // Drag resistance

    useEffect(() => {
        // Detect if mobile (simple check, or rely on touch events existence)
        // We will just run listeners; they won't fire on mouse usually unless emulated.

        const isScrollableWithScrollTop = (element) => {
            let current = element;
            while (current && current !== document.body && current !== document.documentElement) {
                // Check if element is scrollable
                const style = window.getComputedStyle(current);
                const overflowY = style.overflowY;
                const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;

                // If we found a scrollable parent
                if (isScrollable) {
                    // If it is NOT at the top, we should NOT pull-to-refresh
                    if (current.scrollTop > 0) {
                        return true; // It IS scrollable and scrolled down
                    }
                    // If it IS at the top, we continue checking upwards 
                    // (nested scrollables? usually just the first one matters, but let's be safe: 
                    // if we are inside a scrollable div at top, we might want to P2R.
                    // But if we are inside a scrollable div NOT at top, we definitely DON'T.)
                }
                current = current.parentElement;
            }
            return false; // No scrollable parent found that is scrolled down
        };

        const handleTouchStart = (e) => {
            // Only tracking single touch
            if (e.touches.length !== 1) return;

            // Check if we are interacting with a scrolled-down element
            if (isScrollableWithScrollTop(e.target)) {
                isValidStartRef.current = false;
                return;
            }

            isValidStartRef.current = true;
            startYRef.current = e.touches[0].clientY;
            isPullingRef.current = true;
            distanceRef.current = 0;
            // Don't set state yet to avoid re-renders on every tap
        };

        const handleTouchMove = (e) => {
            if (!isPullingRef.current || !isValidStartRef.current) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startYRef.current;

            if (diff > 0) {
                // Pulling down
                const resistedDiff = diff * RESISTANCE;
                distanceRef.current = resistedDiff;
                setDistance(resistedDiff);

                // If we are pulling significantly, prevent default to avoid native scrolling/bounce behaviors if possible
                // Note: preventDefault on touchmove can be tricky with passive listeners.
                // We'll leave it passive for now.
            } else {
                // Pushing up - ignore or reset
                distanceRef.current = 0;
                setDistance(0);
            }
        };

        const handleTouchEnd = () => {
            if (!isPullingRef.current || !isValidStartRef.current) return;

            isPullingRef.current = false;
            isValidStartRef.current = false;

            if (distanceRef.current > THRESHOLD) {
                // Trigger Refresh
                setLoading(true);
                // Animate to hold position? 
                // For simplified reloading, just reload.
                setTimeout(() => {
                    window.location.reload();
                }, 500); // Small delay to show spinner
            } else {
                // Reset
                setDistance(0);
            }
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true }); // passive: true improves performance, but prevents preventDefault()
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    if (distance === 0 && !loading) return null;

    return (
        <div
            className="fixed top-0 left-0 right-0 flex justify-center pointer-events-none z-[9999]"
            style={{
                transform: `translateY(${loading ? THRESHOLD : distance}px)`,
                transition: loading ? 'transform 0.2s ease-out' : 'none'
            }}
        >
            <div
                className="bg-white rounded-full p-2 shadow-lg mb-4 flex items-center justify-center border border-gray-200"
                style={{
                    transform: 'translateY(-100%)', // Start hidden above
                    opacity: Math.min(distance / (THRESHOLD * 0.5), 1)
                }}
            >
                {loading ? (
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <div
                        className="text-blue-600 font-bold text-lg leading-none"
                        style={{ transform: `rotate(${Math.min(distance * 2, 180)}deg)` }}
                    >
                        ⬇
                    </div>
                )}
            </div>
        </div>
    );
};

export default PullToRefreshHandler;
