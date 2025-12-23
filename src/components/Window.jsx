import React, { useState, useEffect, useRef } from 'react';

const Window = ({ title, isOpen, onClose, onMinimize, isActive, onFocus, children, initialPosition = { x: 50, y: 50 }, width = 400, initialSize = null, onStateUpdate }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize || { width: width, height: 'auto' });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Refs to keep track of latest state for event handlers
    const stateRef = useRef({ position, size });
    useEffect(() => {
        stateRef.current = { position, size };
    }, [position, size]);

    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, originalWidth: 0, originalHeight: 0 });
    const windowRef = useRef(null);

    // Detect mobile and constrain window size/position
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);

            if (mobile) {
                // On mobile, force the window to take up most of the screen
                // We leave a small margin for aesthetics and potential touch targets behind (though minimal)
                const margin = 10;
                const availableWidth = window.innerWidth - (margin * 2);

                // Account for taskbar height (approx 40px) plus header
                const availableHeight = window.innerHeight - 50;

                setSize({
                    width: availableWidth,
                    height: 'auto' // Allow content to dictate height, but max-height is controlled by CSS
                });

                // Force position to top-left with margin
                setPosition({ x: margin, y: 50 }); // 50px to account for mobile top bar (40px) + margin
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [width]); // Re-run if width prop changes, but primarily on resize

    if (!isOpen) return null;

    const handleDragStart = (clientX, clientY) => {
        if (isMaximized) return;
        onFocus();
        setIsDragging(true);
        setDragOffset({
            x: clientX - position.x,
            y: clientY - position.y
        });
    };

    const handleMouseDown = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    };

    const handleTouchStart = (e) => {
        if (isMaximized) return;
        if (e.target.closest('button')) return;
        // e.preventDefault(); // Don't prevent default blindly on touch, might interfere with scrolling content?
        // But for title bar drag, we DO want to prevent default scroll.
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    };

    const handleResizeMouseDown = (e) => {
        if (isMaximized) return;
        e.stopPropagation();
        e.preventDefault();
        onFocus();
        setIsResizing(true);
        const rect = windowRef.current.getBoundingClientRect();
        setResizeStart({ x: e.clientX, y: e.clientY, originalWidth: rect.width, originalHeight: rect.height });
        if (size.height === 'auto') {
            setSize({ width: rect.width, height: rect.height });
        }
    };

    useEffect(() => {
        const handleMove = (clientX, clientY) => {
            if (isDragging) {
                // Determine current dims
                const currentWidth = windowRef.current ? windowRef.current.offsetWidth : size.width;
                const currentHeight = windowRef.current ? windowRef.current.offsetHeight : size.height;

                // Strict bounds
                const maxX = Math.max(0, window.innerWidth - currentWidth);
                const minY = isMobile ? 40 : 0; // Top constraint for mobile
                const maxY = Math.max(minY, window.innerHeight - 40 - currentHeight); // 40 is taskbar approx

                let newX = clientX - dragOffset.x;
                let newY = clientY - dragOffset.y;

                // Clamp
                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(minY, Math.min(newY, maxY));

                setPosition({ x: newX, y: newY });
            } else if (isResizing) {
                const deltaX = clientX - resizeStart.x;
                const deltaY = clientY - resizeStart.y;
                let newWidth = Math.max(200, resizeStart.originalWidth + deltaX);
                let newHeight = Math.max(100, resizeStart.originalHeight + deltaY);
                const maxWidth = window.innerWidth - position.x;
                const maxHeight = window.innerHeight - 40 - position.y;
                newWidth = Math.min(newWidth, maxWidth);
                newHeight = Math.min(newHeight, maxHeight);
                setSize({ width: newWidth, height: newHeight });
            }
        };

        const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e) => {
            if (isMobile) return; // Disable touch drag on mobile
            if (isDragging || isResizing) {
                // Prevent scrolling while dragging window
                e.preventDefault();
                const touch = e.touches[0];
                handleMove(touch.clientX, touch.clientY);
            }
        };

        const handleUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            if (onStateUpdate) onStateUpdate(stateRef.current);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, isResizing, dragOffset, resizeStart, isMobile]);

    const windowStyle = isMaximized ? {
        position: 'absolute',
        left: 0,
        top: isMobile ? '40px' : 0,
        width: '100vw',
        height: isMobile ? 'calc(100vh - 80px)' : 'calc(100vh - 40px)', // adjust for top bar on mobile
        zIndex: isActive ? 10 : 1
    } : {
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        maxWidth: isMobile ? 'calc(100vw - 20px)' : 'calc(100vw - 10px)',
        maxHeight: 'calc(100vh - 40px)',
        zIndex: isActive ? 10 : 1
    };

    // calculate font scaling
    const fontScale = Math.min(1.25, Math.max(0.75, 1 + (size.width - width) / width * 0.4));

    return (
        <div
            ref={windowRef}
            className="flex flex-col bg-[#c0c0c0] p-[3px] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#dfdfdf,inset_-2px_-2px_#808080,inset_2px_2px_#ffffff] font-sans"
            style={windowStyle}
            onMouseDown={onFocus}
        >
            {/* Title Bar */}
            <div
                className={`h-[18px] px-1 flex justify-between items-center mb-[2px] select-none ${isActive ? 'bg-gradient-to-r from-[#000080] to-[#1084d0]' : 'bg-[#808080]'}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{ cursor: isMaximized ? 'default' : 'move' }}
            >
                <div className="text-white font-bold text-[11px] truncate flex items-center gap-1 leading-[18px]">
                    {title}
                </div>
                <div className="flex gap-[1px] items-center shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onMinimize(); }}
                        className="w-[14px] h-[14px] bg-[#c0c0c0] flex items-end justify-center border border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white box-border"
                        aria-label="Minimize"
                    >
                        <div className="w-[6px] h-[2px] bg-black mb-[2px]"></div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
                        className="w-[14px] h-[14px] bg-[#c0c0c0] flex items-center justify-center border border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white box-border"
                        aria-label="Maximize"
                    >
                        <div className="w-[6px] h-[6px] border border-black"></div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="w-[14px] h-[14px] bg-[#c0c0c0] flex items-center justify-center border border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white box-border"
                        aria-label="Close"
                    >
                        <span className="text-black text-[8px] font-bold leading-none">✕</span>
                    </button>
                </div>
            </div>

            {/* Window Body */}
            <div
                className="flex-1 bg-[#c0c0c0] text-black overflow-hidden relative"
                style={{ fontSize: `${fontScale}em` }}
            >
                <div className="h-full w-full overflow-auto">
                    {children}
                </div>
            </div>

            {/* Resize Handle */}
            {!isMaximized && (
                <div
                    onMouseDown={handleResizeMouseDown}
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        width: '12px',
                        height: '12px',
                        cursor: 'nwse-resize',
                        zIndex: 20,
                        backgroundImage: 'linear-gradient(135deg, transparent 50%, #808080 50%, #808080 55%, transparent 55%, transparent 60%, #808080 60%, #808080 65%, transparent 65%, transparent 70%, #808080 70%, #808080 75%, transparent 75%, transparent 80%, #808080 80%, #808080 85%, transparent 85%, transparent 90%, #808080 90%, #808080 95%, transparent 95%)'
                    }}
                />
            )}
        </div>
    );
};

export default Window;
