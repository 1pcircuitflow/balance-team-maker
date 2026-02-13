
import React, { useState, useEffect } from 'react';
import { Player, SportType } from '../../types';
import { TRANSLATIONS, Language } from '../../translations';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import {
  createRecruitmentRoom,
  getRoomInfo,
  subscribeToRoom,
  updateRoomFcmToken,
  RecruitmentRoom,
  db,
} from '../../services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { DateTimePicker } from '../DateTimePicker';

// 방장용 모집 관리 모달
export const HostRoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: RecruitmentRoom) => void;
  activeRoom: RecruitmentRoom | null;
  activeRooms: RecruitmentRoom[];
  activeTab: SportType;
  onCloseRoom: () => void;
  onApproveAll: (players: Player[]) => void;
  lang: Language;
  darkMode: boolean;
  isPro: boolean;
  onUpgrade: () => void;
  userNickname: string;
  currentUserId: string;
  activePlayerCount: number;
  showAlert: (msg: string, title?: string) => void;
}> = ({ isOpen, onClose, onRoomCreated, activeRoom, activeRooms, activeTab, onCloseRoom, onApproveAll, lang, darkMode, isPro, onUpgrade, userNickname, currentUserId, activePlayerCount, showAlert }) => {
  /* 날짜/시간 초기값 및 상태 관리 */
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0); // 현재+1시간 정각
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // 종료 시간은 시작 시간 + 2시간 기본값
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0); // Start(+1h) + 2 hours = Current + 3h
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [activePicker, setActivePicker] = useState<'START' | 'END'>('START');

  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };

  const [selectedSport, setSelectedSport] = useState<SportType>(activeTab === SportType.ALL ? SportType.GENERAL : activeTab);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [loading, setLoading] = useState(false);
  const [useLimit, setUseLimit] = useState(false);
  const [maxApplicants, setMaxApplicants] = useState(12);
  const [isPickerSelectionMode, setIsPickerSelectionMode] = useState(false);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');

  useEffect(() => {
    if (isOpen && !activeRoom) {
      // 모달이 열릴 때(새 방 생성 모드인 경우) 날짜와 시간을 현재 기준으로 리셋
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0); // 현재 시간+1의 정각

      const newStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const newStartTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      setStartDate(newStartDate);
      setStartTime(newStartTime);

      // 종료 시간은 시작 + 2시간
      const endD = new Date(d.getTime() + 2 * 60 * 60 * 1000); // 2 hours after start
      setEndDate(`${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`);
      setEndTime(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`);

      const initialSport = activeTab === SportType.ALL ? SportType.GENERAL : activeTab;
      setSelectedSport(initialSport);
      // 제목 자동 초기화 제거하여 플레이스홀더 노출 유도
      setTitle("");
      setVisibility('PRIVATE');
    }

    if (activeRoom?.id && isOpen) {
      // 실시간 방 정보 구독
      const unsub = subscribeToRoom(activeRoom.id, (room) => {
        if (room) onRoomCreated(room);
      });

      // 방장의 최신 푸시 토큰 동기화 (알림용)
      const latestToken = localStorage.getItem('fcm_token');
      if (latestToken) {
        updateRoomFcmToken(activeRoom.id, latestToken);
      }

      return () => unsub();
    }

    // 모달이 열릴 때(또는 활성 룸이 변경될 때) 만료된 방 자동 삭제 체크
    if (isOpen && activeRooms.length > 0) {
      const now = new Date();
      activeRooms.forEach(async (room) => {
        if (room.matchDate && room.matchTime) {
          const matchStart = new Date(`${room.matchDate}T${room.matchTime}`);
          // 30분 여유 시간
          const expireTime = new Date(matchStart.getTime() + 30 * 60000);

          if (now > expireTime) {
            console.log(`Auto deleting expired room: ${room.id} (${room.title})`);
            try {
              await updateDoc(doc(db, "rooms", room.id), { status: 'DELETED' });
              // 모달이 열려있는 동안에만 UI 갱신을 위해 상위 컴포넌트 알림 등은 생략하고
              // 다음 렌더링 때 activeRooms에서 빠지기를 기대하거나 강제로 닫을 수 있음.
              // 여기서는 조용히 백그라운드 삭제만 진행.
            } catch (e) {
              console.error("Auto delete failed:", e);
            }
          }
        }
      });
    }
  }, [activeRoom?.id, isOpen]);

  const handleStartTimeChange = (newDate: string, newTime: string) => {
    setStartDate(newDate);
    setStartTime(newTime);

    // 종료 시간 자동 계산 (시작 시간 + 2시간)
    const start = new Date(`${newDate}T${newTime}`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    // 날짜 포맷팅
    const eYear = end.getFullYear();
    const eMonth = String(end.getMonth() + 1).padStart(2, '0');
    const eDay = String(end.getDate()).padStart(2, '0');
    const eHours = String(end.getHours()).padStart(2, '0');
    const eMinutes = String(end.getMinutes()).padStart(2, '0');

    setEndDate(`${eYear}-${eMonth}-${eDay}`);
    setEndTime(`${eHours}:${eMinutes}`);
  };



  const handleCreate = async () => {
    setLoading(true);
    try {
      const roomId = await createRecruitmentRoom({
        hostId: currentUserId,
        hostName: userNickname,
        title: title.trim() || `${userNickname}${t('matchOf')}`,
        sport: selectedSport,
        matchDate: startDate,
        matchTime: startTime,
        matchEndDate: endDate,
        matchEndTime: endTime,
        maxApplicants: useLimit ? maxApplicants : 0, // 0이면 무제한
        tierMode: '5TIER',
        visibility,
        ...(localStorage.getItem('fcm_token') ? { fcmToken: localStorage.getItem('fcm_token')! } : {}),
        ...(venue.trim() ? { venue: venue.trim() } : {}),
      });

      // 링크생성 및 자동 복사
      const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
      const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${roomId}&lang=${lang}`;

      try {
        await Clipboard.write({ string: webUrl });
        showAlert(t('linkCopiedMsg'), t('linkCopiedTitle'));
      } catch (err) {
        console.error('Clipboard copy failed', err);
      }

      const room = await getRoomInfo(roomId);
      if (room) onRoomCreated(room);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimit = async (newLimit: number) => {
    if (!activeRoom) return;
    try {
      await updateDoc(doc(db, "rooms", activeRoom.id), { maxApplicants: newLimit });
    } catch (e) { console.error(e); }
  };


  const handleShare = async () => {
    if (!activeRoom) return;

    // 실제 배포된 도메인 주소
    const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";

    // 공유 링크는 어떤 환경에서든 항상 운영 주소를 사용하도록 고정합니다.
    // (로컬 주소를 공유할 일이 없으므로 판별 로직 생략)
    const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${activeRoom.id}&lang=${lang}`;

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: t('shareRecruitLink'),
            text: t('shareRecruitMessage', activeRoom.title, activeRoom.matchDate, activeRoom.matchTime, t(activeRoom.sport.toLowerCase()), webUrl),
            dialogTitle: t('shareRecruitLink'),
          });
        } catch (shareError) {
          await Clipboard.write({ string: webUrl });
        }
      } else {
        await Clipboard.write({ string: webUrl });
      }
    } catch (e) {
      try {
        await Clipboard.write({ string: webUrl });
      } catch (err) {
        // Fail silently or log
      }
    }
  };

  if (!isOpen || activeRoom) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      {/* 상단 바 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2 className="text-base font-black text-slate-900 dark:text-white">{activeRoom ? t('manageMatchDetail' as any) : t('recruitParticipants')}</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-[148px]">
        {!activeRoom ? (
          <div className="space-y-4">
            <div className="space-y-4">
              {/* 종목 선택 */}
              <div className="flex items-center gap-4">
                <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('sport' as any)}</label>
                <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 py-1">
                  {[SportType.GENERAL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSport(s);
                        // 종목 변경 시 제목 자동 입력 제거 (플레이스홀더 노출용)
                      }}
                      className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border shrink-0 ${selectedSport === s
                        ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'
                        }`}
                    >
                      {t(s.toLowerCase() as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 팀명 입력 */}
              <div className="flex items-center gap-4">
                <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('roomTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('inputRoomTitle')}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
                />
              </div>

              {/* 장소 입력 */}
              <div className="flex items-center gap-4">
                <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('venue' as any)}</label>
                <input
                  type="text"
                  value={venue}
                  onChange={e => setVenue(e.target.value)}
                  placeholder={t('venuePlaceholder' as any)}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
                />
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* ... 일정 렌더링 유지 ... */}
                  <div
                    onClick={() => setActivePicker('START')}
                    className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                  >
                    <span className="text-[16px] font-black uppercase text-blue-500 mb-1">{t('startTime')}</span>
                    <span className={`text-[16px] font-black ${activePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                      {startDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(startDate).getDay()]}) {startTime}
                    </span>
                  </div>
                  <div className="text-slate-200 dark:text-slate-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </div>
                  <div
                    onClick={() => setActivePicker('END')}
                    className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                  >
                    <span className="text-[16px] font-black uppercase text-rose-500 mb-1">{t('endTime')}</span>
                    <span className={`text-[16px] font-black ${activePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                      {endDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(endDate).getDay()]}) {endTime}
                    </span>
                  </div>
                </div>

                <div className="flex justify-center transition-all duration-300">
                  {activePicker === 'START' ? (
                    <DateTimePicker
                      date={startDate}
                      time={startTime}
                      onChange={handleStartTimeChange}
                      lang={lang}
                      onViewModeChange={(mode) => setIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                    />
                  ) : (
                    <DateTimePicker
                      date={endDate}
                      time={endTime}
                      onChange={(d, t) => { setEndDate(d); setEndTime(t); }}
                      lang={lang}
                      onViewModeChange={(mode) => setIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('limitApplicants')}</label>
                  <button
                    onClick={() => setUseLimit(!useLimit)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${useLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {useLimit && (
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl px-2 py-1 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-2">
                    <button onClick={() => setMaxApplicants(Math.max(2, maxApplicants - 1))} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                    </button>
                    <span className="text-center font-black dark:text-white text-[12px] min-w-[40px]">{t('peopleCount', maxApplicants)}</span>
                    <button onClick={() => setMaxApplicants(maxApplicants + 1)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 공개/비공개 토글 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-3">
                    <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('publicMatch' as any)}</label>
                    <button
                      onClick={() => setVisibility(visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${visibility === 'PUBLIC' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${visibility === 'PUBLIC' ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('publicMatchDesc' as any)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.95] shadow-md shadow-blue-500/20"
                >
                  {loading ? '...' : t('create' as any)}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
