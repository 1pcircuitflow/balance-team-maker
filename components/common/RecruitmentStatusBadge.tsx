import React from 'react';

// V3.0 모집 현황 배지
export const RecruitmentStatusBadge: React.FC<{ count: number; darkMode: boolean }> = ({ count, darkMode }) => {
    if (count === 0) return null;
    return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-white dark:ring-slate-950 animate-bounce">
            {count}
        </span>
    );
};
