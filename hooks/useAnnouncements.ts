import { useState, useEffect, useMemo, useCallback } from 'react';
import { Announcement, subscribeToAnnouncements } from '../services/firebaseService';
import { Language } from '../translations';

export const useAnnouncements = (lang: Language) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const unsub = subscribeToAnnouncements(setAnnouncements);
    return () => unsub();
  }, []);

  const visibleAnnouncement = useMemo(() => {
    return announcements[0] || null;
  }, [announcements]);

  const getAnnouncementText = useCallback((a: Announcement) => {
    if (a.messages && a.messages[lang]) return a.messages[lang]!;
    return a.message;
  }, [lang]);

  return {
    visibleAnnouncement,
    getAnnouncementText,
  };
};
