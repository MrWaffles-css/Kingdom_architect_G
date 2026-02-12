import React, { useState, useEffect, useRef } from 'react';

export default function DraggableWindow({
    children,
    initialPos = { x: 20, y: 20 },
    title = "Window",
    onClose,
    isActive,
    onFocus,
    icon = null,
    minWidth = 300,
    minHeight = 200
}) {
    const [pos, setPos] = useState(initialPos);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const windowRef = useRef(null);

    // Center if no initial pos provided (optional logic, keeping simple for now)

    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only left click
        if (onFocus) onFocus();

        // Calculate offset from the top-left of the window
        /* 
           This logic assumes the handle passed (title bar) is part of this component.
           But usually, DraggableWindow WRAPS the content, and we provide the title bar here 
           OR we expect the children to have a drag handle.
           
           Better approach for Win98 style: 
           The WindowWrapper in WelcomePage currently draws the title bar. 
           We should probably replace `WindowWrapper` entirely or wrap it.
           
           Let's make this component RENDER the window frame (Title bar + borders) 
           so it controls the drag handle directly.
        */

        // Calculate offset relative to the window's current position
        const rect = windowRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            // Calculate new position
            let newX = e.clientX - dragOffset.x;
            let newY = e.clientY - dragOffset.y;

            // Optional: Bounds checking (keep title bar visible)
            if (newY < 0) newY = 0;
            if (newX < -windowRef.current.offsetWidth + 50) newX = -windowRef.current.offsetWidth + 50;
            if (newX > window.innerWidth - 50) newX = window.innerWidth - 50;
            if (newY > window.innerHeight - 50) newY = window.innerHeight - 50;

            setPos({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    return (
        <div
            ref={windowRef}
            className={`fixed flex flex-col bg-[#c0c0c0] border-2 border-white border-r-black border-b-black shadow-xl
                ${isActive ? 'z-50' : 'z-40'}
            `}
            style={{
                left: pos.x,
                top: pos.y,
                minWidth: minWidth,
                minHeight: minHeight,
                width: 'auto',
                maxWidth: '95vw',
                maxHeight: '90vh'
            }}
            onClick={onFocus}
        >
            {/* Title Bar - The Drag Handle */}
            <div
                className={`p-1 flex justify-between items-center shrink-0 select-none cursor-default
                    ${isActive
                        ? 'bg-gradient-to-r from-[#000080] to-[#1084d0]'
                        : 'bg-gray-400'
                    }
                `}
                onMouseDown={handleMouseDown}
            >
                <div className="text-white font-bold flex items-center gap-1 pl-1 text-sm">
                    {icon && <img src={icon} alt="" className="w-4 h-4 pixelated" />}
                    <span className="truncate">{title}</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="w-4 h-3.5 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black flex items-center justify-center font-bold text-[8px] hover:bg-gray-300 active:border-black active:border-r-white active:border-b-white active:translate-y-[1px]"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 overflow-auto p-1`}>
                {children}
            </div>
        </div>
    );
}
