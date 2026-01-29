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
    const itemHeight = 30; // Compact height

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
        <div className={`relative h-[90px] overflow-hidden ${width} touch-none select-none`}>
            {/* 중앙 하이라이트 라인 */}
            <div className="absolute top-[30px] left-0 right-0 h-[30px] border-t border-b border-slate-200 dark:border-slate-800 pointer-events-none z-0" />
            <div
                ref={scrollRef}
                className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide py-[30px]"
                onScroll={(e) => {
                    clearTimeout((scrollRef.current as any)._timeout);
                    (scrollRef.current as any)._timeout = setTimeout(handleScrollEnd, 50); // Faster response
                }}
            >
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`h-[30px] flex items-center justify-center snap-center z-10 relative cursor-pointer text-[10px]
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

    // Derived states for WheelPicker
    const isPM = hour >= 12;
    const ampmStr = isPM ? t('pm') : t('am');
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const displayHourStr = String(displayHour);
    const minuteStr = String(minute).padStart(2, '0');

    // Calendar logic
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
        const lastDateOfMonth = new Date(currentYear, currentMonth, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
        for (let i = 1; i <= lastDateOfMonth; i++) days.push(i);
        return days;
    }, [currentYear, currentMonth]);

    // Helpers to notify change immediately
    const update = (newDate: string, newTime: string) => {
        onChange(newDate, newTime);
    };

    const handleDateSelect = (d: number) => {
        const newDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        update(newDate, time); // Keep current time
    };

    const handleMonthChange = (delta: number) => {
        let newM = currentMonth + delta;
        let newY = currentYear;
        if (newM > 12) { newM = 1; newY++; }
        if (newM < 1) { newM = 12; newY--; }

        // 날짜가 해당 월의 최대 일수를 넘지 않도록 조정
        const lastDayOfNewMonth = new Date(newY, newM, 0).getDate();
        const newD = Math.min(currentDate, lastDayOfNewMonth);

        const newDate = `${newY}-${String(newM).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
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

    return (
        <div className="flex flex-col w-full bg-white dark:bg-slate-900 rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
            {/* 헤더 (Compact) */}
            <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                    {currentYear}{lang === 'ko' ? '.' : '/'}{String(currentMonth).padStart(2, '0')}
                </span>
                <div className="flex gap-2">
                    <button onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                        <Icons.MinusIcon className="w-3 h-3 text-slate-600 dark:text-slate-400 rotate-90" />
                    </button>
                    <button onClick={() => handleMonthChange(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                        <Icons.PlusIcon className="w-3 h-3 text-slate-600 dark:text-slate-400 -rotate-90" />
                    </button>
                </div>
            </div>

            {/* 요일 (Compact) */}
            <div className="grid grid-cols-7 px-2 mb-1">
                {t('days').map((day: string, i: number) => (
                    <div key={i} className="text-center text-[9px] font-bold text-slate-400 dark:text-slate-600">
                        {day}
                    </div>
                ))}
            </div>

            {/* 날짜 그리드 (Compact) */}
            <div className="grid grid-cols-7 px-2 gap-y-0.5 mb-2">
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

            {/* 구분선 */}
            <div className="h-px bg-slate-100 dark:bg-slate-800 mx-4 mb-2" />

            {/* 시간 휠 (Compact) */}
            <div className="flex justify-center items-center px-4 mb-3 gap-2">
                <WheelPicker items={ampmItems} selected={ampmStr} onSelect={(v) => handleTimeChange('AMPM', v)} width="w-14" />
                <WheelPicker items={hourItems} selected={displayHourStr} onSelect={(v) => handleTimeChange('HOUR', v)} width="w-10" />
                <div className="text-slate-300 dark:text-slate-700 font-bold text-xs pb-1">:</div>
                <WheelPicker items={minuteItems} selected={minuteStr} onSelect={(v) => handleTimeChange('MINUTE', v)} width="w-10" />
            </div>
        </div>
    );
};
