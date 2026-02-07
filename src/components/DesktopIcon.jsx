import React from 'react';

const DesktopIcon = ({ label, icon, badge, ...props }) => {
    return (
        <div
            className={`flex flex-col items-center justify-start p-2 cursor-pointer hover:bg-white/20 border border-transparent hover:border-white/20 rounded w-24 h-28 text-center group select-none ${props.className || ''}`}
            {...props}
        >
            <div className="w-12 h-12 mb-1 flex items-center justify-center filter drop-shadow-md pointer-events-none relative mx-auto">
                {typeof icon === 'string' && icon.length < 5 ? (
                    <span className="text-4xl">{icon}</span>
                ) : (
                    <div className="w-full h-full flex items-center justify-center [&>img]:w-full [&>img]:h-full [&>img]:object-contain pixelated">
                        {icon}
                    </div>
                )}
                {badge > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center border border-white z-20 shadow-sm pointer-events-none">
                        {badge > 99 ? '99+' : badge}
                    </div>
                )}
            </div>
            <span className="text-white text-xs leading-tight text-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] font-sans px-1 bg-transparent group-hover:bg-[#000080] group-hover:text-white line-clamp-2 max-w-full break-normal pointer-events-none bg-opacity-0">
                {label}
            </span>
        </div>
    );
};

export default DesktopIcon;
