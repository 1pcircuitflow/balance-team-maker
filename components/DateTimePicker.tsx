import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TRANSLATIONS, Language } from '../translations';
import * as Icons from '../Icons';

interface DateTimePickerProps {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    onChange: (date: string, time: string) => void;
    lang: Language;
    onClose?: () => void;
}

const WheelPicker: React.FC<{
    items: string[];
    selected: string;
    onSelect: (value: string) => void;
    width?: string;
    darkMode?: boolean;
}> = ({ items, selected, onSelect, width = 'w-16' }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const itemHeight = 26; // Ultra compact

    useEffect(() => {
        if (scrollRef.current) {
            const index = items.indexOf(selected);
            if (index !== -1) {
                scrollRef.current.scrollTop = index * itemHeight;
            }
        }
    }, [selected, items]);

    const handleScrollEnd = () => {
        if (scrollRef.current) {
            const scrollTop = scrollRef.current.scrollTop;
            const index = Math.round(scrollTop / itemHeight);
            if (items[index] && items[index] !== selected) {
                onSelect(items[index]);
            }
        }
    };

    return (
        <div className={`relative h-[78px] overflow-hidden ${width} touch-none select-none`}>
            {/* 중앙 하이라이트 라인 */}
            <div className="absolute top-[26px] left-0 right-0 h-[26px] border-t border-b border-slate-200 dark:border-slate-800 pointer-events-none z-0" />
            <div
                ref={scrollRef}
                className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide py-[26px]"
                onScroll={(e) => {
                    clearTimeout((scrollRef.current as any)._timeout);
                    (scrollRef.current as any)._timeout = setTimeout(handleScrollEnd, 50);
                }}
            >
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`h-[26px] flex items-center justify-center snap-center z-10 relative cursor-pointer text-[10px]
              ${item === selected
                                ? 'font-bold text-slate-900 dark:text-white scale-110'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                        onClick={() => onSelect(item)}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ date, time, onChange, lang }) => {
    const t = (key: any): any => (TRANSLATIONS[lang] as any)[key] || key;

    // Parse input props
    const [yStr, mStr, dStr] = date.split('-');
    const currentYear = parseInt(yStr);
    const currentMonth = parseInt(mStr);
    const currentDate = parseInt(dStr);

    const [hStr, minStr] = time.split(':');
    const hour = parseInt(hStr);
    const minute = parseInt(minStr);

    // Derived states
    const isPM = hour >= 12;
    const ampmStr = isPM ? t('pm') : t('am');
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const displayHourStr = String(displayHour);
    const minuteStr = String(minute).padStart(2, '0');

    // UI State
    const [viewMode, setViewMode] = useState<'CALENDAR' | 'YEAR_MONTH_SELECT'>('CALENDAR');

    // Calendar logic (memoized)
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
        const lastDateOfMonth = new Date(currentYear, currentMonth, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
        for (let i = 1; i <= lastDateOfMonth; i++) days.push(i);
        return days;
    }, [currentYear, currentMonth]);

    const update = (newDate: string, newTime: string) => {
        onChange(newDate, newTime);
    };

    const handleDateSelect = (d: number) => {
        const newDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        update(newDate, time); // Keep current time
    };

    const handleYearSelect = (y: number) => {
        const lastDate = new Date(y, currentMonth, 0).getDate();
        const d = Math.min(currentDate, lastDate);
        const newDate = `${y}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        update(newDate, time);
    };

    const handleMonthSelect = (m: number) => {
        const lastDate = new Date(currentYear, m, 0).getDate();
        const d = Math.min(currentDate, lastDate);
        const newDate = `${currentYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        update(newDate, time);
        setViewMode('CALENDAR');
    };

    const handleTimeChange = (type: 'AMPM' | 'HOUR' | 'MINUTE', val: string) => {
        let newH = hour;
        let newMin = minute;

        if (type === 'AMPM') {
            if (val === t('pm') && !isPM) newH += 12;
            if (val === t('am') && isPM) newH -= 12;
        }
        if (type === 'HOUR') {
            let hVal = parseInt(val);
            if (isPM && hVal !== 12) hVal += 12;
            if (!isPM && hVal === 12) hVal = 0;
            newH = hVal;
        }
        if (type === 'MINUTE') {
            newMin = parseInt(val);
        }

        const newTime = `${String(newH).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
        update(date, newTime);
    };

    // UI Helpers
    const isToday = (d: number) => {
        const today = new Date();
        return today.getFullYear() === currentYear && (today.getMonth() + 1) === currentMonth && today.getDate() === d;
    };
    const isSelected = (d: number) => d === currentDate;

    const ampmItems = [t('am'), t('pm')];
    const hourItems = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const minuteItems = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

    const yearBase = new Date().getFullYear();
    const selectYears = Array.from({ length: 12 }, (_, i) => yearBase - 5 + i);
    const selectMonths = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="flex flex-col w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-center py-1.5 relative">
                <button
                    onClick={() => setViewMode(prev => prev === 'CALENDAR' ? 'YEAR_MONTH_SELECT' : 'CALENDAR')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95"
                >
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                        {currentYear}{lang === 'ko' ? '.' : '/'}{String(currentMonth).padStart(2, '0')}
                    </span>
                    <Icons.PlusIcon
                        className={`w-2.5 h-2.5 text-slate-400 transition-transform ${viewMode === 'YEAR_MONTH_SELECT' ? 'rotate-180' : ''}`}
                        style={{ transform: viewMode === 'YEAR_MONTH_SELECT' ? 'rotate(135deg)' : 'rotate(0deg)' }}
                    />
                </button>
            </div>

            {viewMode === 'YEAR_MONTH_SELECT' ? (
                <div className="flex flex-col h-[180px] animate-in fade-in zoom-in-95 duration-200 p-1 gap-1">
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <div className="grid grid-cols-4 gap-1 p-0.5">
                            {selectYears.map(y => (
                                <button
                                    key={y}
                                    onClick={() => handleYearSelect(y)}
                                    className={`py-1 rounded-md text-[10px] font-bold transition-all ${y === currentYear
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-800 shrink-0" />
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <div className="grid grid-cols-4 gap-1 p-0.5">
                            {selectMonths.map(m => (
                                <button
                                    key={m}
                                    onClick={() => handleMonthSelect(m)}
                                    className={`py-1 rounded-md text-[10px] font-bold transition-all ${m === currentMonth
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Days */}
                    <div className="grid grid-cols-7 px-3 mb-0.5">
                        {t('days').map((day: string, i: number) => (
                            <div key={i} className="text-center text-[9px] font-bold text-slate-400 dark:text-slate-600">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-7 px-3 gap-y-0.5 mb-1.5">
                        {calendarDays.map((d, i) => (
                            <div key={i} className="aspect-square flex items-center justify-center p-0.5">
                                {d && (
                                    <button
                                        onClick={() => handleDateSelect(d)}
                                        className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all
                                            ${isSelected(d)
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : isToday(d)
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    >
                                        {d}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-100 dark:bg-slate-800 mx-3 mb-1" />

                    {/* Wheel */}
                    <div className="flex justify-center items-center px-3 mb-1 gap-1.5">
                        <WheelPicker items={ampmItems} selected={ampmStr} onSelect={(v) => handleTimeChange('AMPM', v)} width="w-12" />
                        <WheelPicker items={hourItems} selected={displayHourStr} onSelect={(v) => handleTimeChange('HOUR', v)} width="w-9" />
                        <div className="text-slate-300 dark:text-slate-700 font-bold text-[10px] pb-0.5">:</div>
                        <WheelPicker items={minuteItems} selected={minuteStr} onSelect={(v) => handleTimeChange('MINUTE', v)} width="w-9" />
                    </div>
                </>
            )}
        </div>
    );
};
