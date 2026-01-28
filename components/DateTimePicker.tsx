
import React, { useRef, useEffect, useState } from 'react';

interface WheelPickerProps {
    items: string[];
    selected: string;
    onSelect: (value: string) => void;
    width?: string;
}

const WheelPicker: React.FC<WheelPickerProps> = ({ items, selected, onSelect, width = 'w-16' }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const itemHeight = 40; // Height of each item in pixels

    // 수동 스크롤 감지 및 스냅 처리
    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollTop = scrollRef.current.scrollTop;
            const index = Math.round(scrollTop / itemHeight);
            if (items[index] && items[index] !== selected) {
                // Debounce or verify if this causes too many updates.
                // For smoother UX, we might update selection only on scroll end, but real-time is responsive.
                // Let's rely on scrollEnd or simple timeout if performance is bad.
                // For now, updating on click or snap is better. 
                // We will just highlight the centered item visually, and trigger onSelect on scroll end.
            }
        }
    };

    // 스크롤 종료 시 선택 값 업데이트
    const handleScrollEnd = () => {
        if (scrollRef.current) {
            const scrollTop = scrollRef.current.scrollTop;
            const index = Math.round(scrollTop / itemHeight);
            if (items[index]) {
                onSelect(items[index]);
            }
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            const index = items.indexOf(selected);
            if (index !== -1) {
                scrollRef.current.scrollTop = index * itemHeight;
            }
        }
    }, [selected, items]); // selected가 외부에서 바뀌었을 때만 반응하도록 주의 (무한루프 방지)
    // 하지만 여기서는 초기 로드 및 외부 변경 시 스크롤 위치 동기화 용도.
    // 사용자가 스크롤 중일 때는 onSelect가 호출되어 selected가 바뀌고, 다시 useEffect가 불리면 스크롤이 튈 수 있음.
    // 따라서 isScrolling 상태 관리가 필요할 수 있음. 
    // 간단하게 구현하기 위해: 스크롤 이벤트 핸들러에서 onSelect를 호출할 때, 
    // 부모가 selected를 업데이트하고 내려주면 useEffect가 실행됨.
    // 이 때 스크롤 위치가 미묘하게 조정(스냅)되는 효과가 있음.

    return (
        <div className={`relative h-[200px] overflow-hidden ${width} touch-none select-none`}>
            {/* Selection Indicator */}
            <div className="absolute top-[80px] left-0 right-0 h-[40px] bg-slate-100 dark:bg-transparent rounded-lg pointer-events-none opacity-50 z-0" />

            {/* Scroll Container */}
            <div
                ref={scrollRef}
                className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide py-[80px]"
                onScroll={(e) => {
                    // Optional: Realtime highlight logic if needed
                }}
                onTouchEnd={handleScrollEnd}
                onMouseUp={handleScrollEnd}
                onWheel={() => {
                    // Debounce scroll end for wheel
                    clearTimeout((scrollRef.current as any)._timeout);
                    (scrollRef.current as any)._timeout = setTimeout(handleScrollEnd, 100);
                }}
                style={{ scrollBehavior: 'smooth' }}
            >
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`h-[40px] flex items-center justify-center snap-center z-10 relative cursor-pointer
              ${item === selected
                                ? 'font-bold text-slate-900 dark:text-white text-sm transition-transform'
                                : 'text-slate-400 dark:text-slate-500 text-sm opacity-60'
                            }`}
                        onClick={() => {
                            onSelect(item);
                            if (scrollRef.current) {
                                scrollRef.current.scrollTo({ top: i * itemHeight, behavior: 'smooth' });
                            }
                        }}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface DateTimePickerProps {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    onChange: (date: string, time: string) => void;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ date, time, onChange }) => {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + i)); // Current + 5 years
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

    // Days generator considering leap year and month
    const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
    const daysInMonth = getDaysInMonth(year, month);

    // Generate dates with Day of Week
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const dateObj = new Date(year, month - 1, d);
        const weekDay = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
        return `${d}일 ${weekDay}`;
    });

    // AM/PM Logic
    const isPM = hour >= 12;
    const ampm = isPM ? '오후' : '오전';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    // Hours 1-12
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
    // Minutes 00-59
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    const ampms = ['오전', '오후'];

    // Handlers
    const handleYearChange = (val: string) => {
        const newDate = `${val}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Validate day if month/year changes (e.g. Feb 29)
        // Simple fix: if day exceeds new max, clamp it.
        // BUT here we just pass simple string. Logic refinement needed.
        onChange(newDate, time); // Simple update, parent handles or we rely on useEffects?
        // Better: Calculate full new string here
        updateDateTime(Number(val), month, day, hour, minute);
    };

    const handleMonthChange = (val: string) => {
        const m = Number(val);
        updateDateTime(year, m, day, hour, minute);
    };

    const handleDayChange = (val: string) => {
        // val is "27일 화"
        const d = parseInt(val);
        updateDateTime(year, month, d, hour, minute);
    };

    const handleAmPmChange = (val: string) => {
        let h = hour;
        if (val === '오전' && isPM) h -= 12;
        if (val === '오후' && !isPM) h += 12;
        updateDateTime(year, month, day, h, minute);
    };

    const handleHourChange = (val: string) => {
        let h = Number(val);
        if (isPM && h !== 12) h += 12;
        if (!isPM && h === 12) h = 0;
        updateDateTime(year, month, day, h, minute);
    };

    const handleMinuteChange = (val: string) => {
        updateDateTime(year, month, day, hour, Number(val));
    };

    const updateDateTime = (y: number, m: number, d: number, h: number, min: number) => {
        // Clamp day
        const maxDay = getDaysInMonth(y, m);
        const validDay = Math.min(d, maxDay);

        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
        const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        onChange(dateStr, timeStr);
    };

    const currentDayStr = `${day}일 ${['일', '월', '화', '수', '목', '금', '토'][new Date(year, month - 1, day).getDay()]}`;

    return (
        <div className="flex justify-center items-center gap-0 w-full bg-white dark:bg-slate-900 rounded-xl p-4">
            <WheelPicker items={years} selected={String(year)} onSelect={handleYearChange} width="w-16" />
            <WheelPicker items={months} selected={String(month)} onSelect={handleMonthChange} width="w-12" />
            <WheelPicker items={days} selected={currentDayStr} onSelect={handleDayChange} width="w-24" />

            <div className="w-4" /> {/* Spacer */}

            <WheelPicker items={ampms} selected={ampm} onSelect={handleAmPmChange} width="w-16" />
            <WheelPicker items={hours} selected={String(displayHour)} onSelect={handleHourChange} width="w-12" />
            <div className="text-slate-400 font-bold pb-2">:</div>
            <WheelPicker items={minutes} selected={String(minute).padStart(2, '0')} onSelect={handleMinuteChange} width="w-12" />
        </div>
    );
};
