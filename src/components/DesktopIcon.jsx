import React from 'react';

const DesktopIcon = ({ label, icon, badge, ...props }) => {
    return (
        <div
            className="flex flex-col items-center justify-start p-2 cursor-pointer hover:bg-white/20 border border-transparent hover:border-white/20 rounded w-20 h-24 text-center group absolute select-none"
            {...props}
        >
            <div className="w-8 h-8 mb-1 flex items-center justify-center filter drop-shadow-md pointer-events-none relative">
                {typeof icon === 'string' && icon.length < 5 ? (
                    <span className="text-3xl">{icon}</span>
                ) : (
                    icon
                )}
                {badge > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center border border-white z-20 shadow-sm pointer-events-none">
                        {badge > 99 ? '99+' : badge}
                    </div>
                )}
            </div>
            <span className="text-white text-xs drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] font-sans px-1 bg-transparent group-hover:bg-[#000080] group-hover:text-white line-clamp-2 pointer-events-none bg-opacity-0">
                {label}
            </span>
        </div>
    );
};

export default DesktopIcon;
