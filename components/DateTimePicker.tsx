import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TRANSLATIONS, Language } from '../translations';
import * as Icons from '../Icons';

interface DateTimePickerProps {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    onChange: (date: string, time: string) => void;
    lang: Language;
    onClose?: () => void;
    onViewModeChange?: (mode: 'CALENDAR' | 'YEAR_MONTH_SELECT') => void;
}

const WheelPicker: React.FC<{
    items: string[];
    selected: string;
    onSelect: (value: string) => void;
    width?: string;
    itemHeight?: number; // Custom item height
    height?: number; // Custom total height
    fontSize?: string; // Custom font size
}> = ({ items, selected, onSelect, width = 'w-16', itemHeight = 26, height = 78, fontSize = 'text-[10px]' }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const index = items.indexOf(selected);
            if (index !== -1) {
                // 렌더링 타이밍 이슈로 스크롤이 씹히는 현상 방지
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = index * itemHeight;
                    }
                }, 10);
            }
        }
    }, [selected, items, itemHeight]);

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
        <div className={`relative overflow-hidden ${width} touch-none select-none`} style={{ height: `${height}px` }}>
            {/* 중앙 하이라이트 라인 */}
            <div className={`absolute left-0 right-0 border-t border-b border-slate-200 dark:border-slate-800 pointer-events-none z-0`}
                style={{ top: `${itemHeight}px`, height: `${itemHeight}px` }}
            />
            <div
                ref={scrollRef}
                className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
                style={{ paddingBlock: `${itemHeight}px` }}
                onScroll={(e) => {
                    clearTimeout((scrollRef.current as any)._timeout);
                    (scrollRef.current as any)._timeout = setTimeout(handleScrollEnd, 50);
                }}
            >
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`flex items-center justify-center snap-center z-10 relative cursor-pointer ${fontSize}
              ${item === selected
                                ? 'font-bold text-slate-900 dark:text-white scale-110'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                        style={{ height: `${itemHeight}px` }}
                        onClick={() => onSelect(item)}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ date, time, onChange, lang, onViewModeChange }) => {
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
    const [viewMode, setViewModeState] = useState<'CALENDAR' | 'YEAR_MONTH_SELECT'>('CALENDAR');

    const setViewMode = (mode: 'CALENDAR' | 'YEAR_MONTH_SELECT') => {
        setViewModeState(mode);
        if (onViewModeChange) onViewModeChange(mode);
    };

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

    // Wheel Handlers (Directly updates state)
    const handleYearChange = (val: string) => {
        const y = parseInt(val);
        const lastDate = new Date(y, currentMonth, 0).getDate();
        const d = Math.min(currentDate, lastDate);
        const newDate = `${y}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        update(newDate, time);
    };

    const handleMonthChange = (val: string) => {
        const m = parseInt(val);
        const lastDate = new Date(currentYear, m, 0).getDate();
        const d = Math.min(currentDate, lastDate);
        const newDate = `${currentYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        update(newDate, time);
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

    // Year/Month Wheel Data
    const yearBase = new Date().getFullYear();
    const selectYears = Array.from({ length: 101 }, (_, i) => String(yearBase - 50 + i)); // +/- 50 years
    const selectMonths = Array.from({ length: 12 }, (_, i) => String(i + 1));

    return (
        <div className="flex flex-col w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-300">
            {/* Header (Refined) */}
            <div className="flex items-center justify-center py-2 relative">
                <button
                    onClick={() => setViewMode(viewMode === 'CALENDAR' ? 'YEAR_MONTH_SELECT' : 'CALENDAR')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all active:scale-95 group
                        ${viewMode === 'YEAR_MONTH_SELECT' ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                        {currentYear}{lang === 'ko' ? '년' : '.'} {String(currentMonth).padStart(2, '0')}{lang === 'ko' ? '월' : ''}
                    </span>
                    <div className={`transition-transform duration-300 ${viewMode === 'YEAR_MONTH_SELECT' ? 'rotate-180' : ''}`}>
                        <Icons.ChevronDownIcon />
                    </div>
                </button>
            </div>

            {/* Content Area */}
            <div className="relative overflow-hidden">
                {viewMode === 'YEAR_MONTH_SELECT' ? (
                    <div className="flex flex-col items-center justify-center h-[181px] animate-in fade-in zoom-in-95 duration-200">
                        {/* Wheel Area */}
                        <div className="flex items-center justify-center gap-4 mb-3 w-full px-8">
                            {/* Year Wheel */}
                            <div className="flex-1 flex justify-center">
                                <WheelPicker
                                    items={selectYears}
                                    selected={String(currentYear)}
                                    onSelect={handleYearChange}
                                    width="w-full"
                                    itemHeight={36}
                                    height={108}
                                    fontSize="text-lg"
                                />
                            </div>
                            {/* Month Wheel */}
                            <div className="flex-1 flex justify-center">
                                <WheelPicker
                                    items={selectMonths}
                                    selected={String(currentMonth)}
                                    onSelect={handleMonthChange}
                                    width="w-full"
                                    itemHeight={36}
                                    height={108}
                                    fontSize="text-lg"
                                />
                            </div>
                        </div>

                        {/* Select Button */}
                        <div className="flex justify-end w-full px-4">
                            <button
                                onClick={() => setViewMode('CALENDAR')}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
                            >
                                {t('select')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
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

                        {/* Time Wheel (Ultra Compact) */}
                        <div className="flex justify-center items-center px-3 mb-1 gap-1.5">
                            <WheelPicker items={ampmItems} selected={ampmStr} onSelect={(v) => handleTimeChange('AMPM', v)} width="w-12" />
                            <WheelPicker items={hourItems} selected={displayHourStr} onSelect={(v) => handleTimeChange('HOUR', v)} width="w-9" />
                            <div className="text-slate-300 dark:text-slate-700 font-bold text-[10px] pb-0.5">:</div>
                            <WheelPicker items={minuteItems} selected={minuteStr} onSelect={(v) => handleTimeChange('MINUTE', v)} width="w-9" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
