import React from 'react';

export default function GuideArrow({ className = '', direction = 'left' }) {
    // Rotation based on direction
    const rotation = {
        'up': 'rotate-90',
        'down': '-rotate-90',
        'left': 'rotate-0',
        'right': 'rotate-180'
    }[direction];

    return (
        <div className={`pointer-events-none absolute z-50 animate-bounce ${className}`}>
            <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`text-red-600 drop-shadow-md filter ${rotation}`}
            >
                <path
                    d="M20 12H4M4 12L10 6M4 12L10 18"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
}
