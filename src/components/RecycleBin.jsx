import React from 'react';

export default function RecycleBin() {
    return (
        <div className="bg-white p-4 h-full">
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <img
                    src="https://win98icons.alexmeub.com/icons/png/recycle_bin_empty-0.png"
                    alt="Empty Recycle Bin"
                    className="w-16 h-16 mb-4"
                />
                <p className="text-red-600 font-bold text-lg text-center">Your account has successfully been deleted.</p>
            </div>
        </div>
    );
}
