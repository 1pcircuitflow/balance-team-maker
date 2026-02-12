import React, { useEffect, useRef } from 'react';
import { Announcement } from '../services/firebaseService';

interface AnnouncementBannerProps {
  visibleAnnouncement: Announcement;
  getAnnouncementText: (a: Announcement) => string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = React.memo(({
  visibleAnnouncement, getAnnouncementText,
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: Animation | null = null;
    const timer = setTimeout(() => {
      const textEl = textRef.current;
      const wrapEl = wrapRef.current;
      if (textEl && wrapEl && textEl.scrollWidth > wrapEl.clientWidth) {
        const distance = textEl.scrollWidth - wrapEl.clientWidth + 40;
        const slideDuration = distance * 50;
        const pause = 1500;
        const totalDuration = slideDuration + pause * 2;
        const pauseRatio = pause / totalDuration;
        anim = textEl.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(0)', offset: pauseRatio },
            { transform: `translateX(-${distance}px)`, offset: 1 - pauseRatio },
            { transform: `translateX(-${distance}px)` },
          ],
          { duration: totalDuration, iterations: Infinity }
        );
      }
    }, 300);
    return () => { clearTimeout(timer); anim?.cancel(); };
  }, [visibleAnnouncement]);

  return (
    <div
      className="w-full px-5 py-2.5 flex items-center gap-2 cursor-pointer"
      onClick={() => { if (visibleAnnouncement.link) window.open(visibleAnnouncement.link, '_blank'); }}
    >
      <span className="text-blue-600 dark:text-blue-400 shrink-0 text-[14px]">📢</span>
      <div className="flex-1 overflow-hidden">
        <div ref={wrapRef} className="overflow-hidden">
          <span ref={textRef} className="text-[12px] font-medium text-blue-800 dark:text-blue-200 whitespace-nowrap inline-block">
            {getAnnouncementText(visibleAnnouncement)}
          </span>
        </div>
      </div>
    </div>
  );
});
