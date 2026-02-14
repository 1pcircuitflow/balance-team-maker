import React from 'react';
import { SportType, AppPageType } from '../types';
import { Z_INDEX } from '../constants';
import { TRANSLATIONS } from '../translations';
import { DateTimePicker } from '../components/DateTimePicker';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { ArrowLeftIcon } = Icons;

export const EditRoomPage: React.FC = React.memo(() => {
  const { t, lang } = useAppContext();
  const { isProcessing, setIsProcessing, isAdFree } = useAuthContext();
  const { setCurrentPage } = useNavigationContext();
  const {
    hostRoomSelectedSport, setHostRoomSelectedSport,
    hostRoomTitle, setHostRoomTitle,
    hostRoomVenue, setHostRoomVenue,
    hostRoomDescription, setHostRoomDescription,
    hostRoomDate, setHostRoomDate, hostRoomTime, setHostRoomTime,
    hostRoomEndDate, setHostRoomEndDate, hostRoomEndTime, setHostRoomEndTime,
    hostRoomUseLimit, setHostRoomUseLimit,
    hostRoomMaxApplicants, setHostRoomMaxApplicants,
    hostRoomVisibility, setHostRoomVisibility,
    hostRoomActivePicker, setHostRoomActivePicker,
    setHostRoomIsPickerSelectionMode,
    handleUpdateRoom,
  } = useRecruitmentContext();
  return (
    <div className="fixed left-0 right-0 top-0 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden"
      style={{ zIndex: Z_INDEX.RESULT_OVERLAY, bottom: isAdFree ? '0px' : '80px' }}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
        <button
          onClick={() => setCurrentPage(AppPageType.DETAIL)}
          className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <h2 className="text-[16px] font-black text-slate-900 dark:text-white">{t('editMatch')}</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        <div className="space-y-4">
          <div className="space-y-4">
            {/* 종목 선택 */}
            <div className="flex items-center gap-4">
              <label className="w-12 text-[14px] font-medium text-slate-900 dark:text-white shrink-0">{t('sport')}</label>
              <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 py-1">
                {[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].map((s) => (
                  <button
                    key={s}
                    onClick={() => setHostRoomSelectedSport(s)}
                    className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border shrink-0 ${hostRoomSelectedSport === s
                      ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                      : 'bg-white text-slate-700 border-slate-400 dark:bg-slate-900 dark:text-white dark:border-slate-700'
                      }`}
                  >
                    {t(s.toLowerCase())}
                  </button>
                ))}
              </div>
            </div>

            {/* 장소 입력 */}
            <div className="flex items-center gap-4">
              <label className="w-12 text-[14px] font-medium text-slate-900 dark:text-white shrink-0">{t('venue')}</label>
              <input
                type="text"
                value={hostRoomVenue}
                onChange={(e) => setHostRoomVenue(e.target.value)}
                placeholder={t('venuePlaceholder')}
                className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
              />
            </div>

            {/* 제목 입력 */}
            <div className="flex items-center gap-4">
              <label className="w-12 text-[14px] font-medium text-slate-900 dark:text-white shrink-0">{t('roomTitle')}</label>
              <input
                type="text"
                value={hostRoomTitle}
                onChange={(e) => setHostRoomTitle(e.target.value)}
                placeholder={t('inputRoomTitle')}
                className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
              />
            </div>

            {/* 내용 입력 */}
            <div className="flex items-start gap-4">
              <label className="w-12 text-[14px] font-medium text-slate-900 dark:text-white shrink-0 pt-3">{t('roomDescription')}</label>
              <textarea
                value={hostRoomDescription}
                onChange={(e) => setHostRoomDescription(e.target.value)}
                placeholder={t('inputRoomDescription')}
                rows={3}
                className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px] resize-none"
              />
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          {/* 옵션 섹션 */}
          <div className="space-y-4">
            {/* 모집인원 제한 */}
            <div className="flex items-center justify-between">
              <label className="text-[14px] font-medium text-slate-900 dark:text-white">{t('limitApplicants')}</label>
              <div className="flex items-center gap-3">
                {hostRoomUseLimit && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                    <button onClick={() => setHostRoomMaxApplicants(Math.max(2, hostRoomMaxApplicants - 1))} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                    </button>
                    <span className="text-center font-bold text-slate-900 dark:text-white text-[13px] min-w-[36px]">{t('peopleCount', hostRoomMaxApplicants)}</span>
                    <button onClick={() => setHostRoomMaxApplicants(hostRoomMaxApplicants + 1)} className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setHostRoomUseLimit(!hostRoomUseLimit)}
                  className={`relative w-[42px] h-[26px] rounded-full transition-colors duration-200 flex-shrink-0 ${hostRoomUseLimit ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-transform duration-200 ${hostRoomUseLimit ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                </button>
              </div>
            </div>

            {/* 공개경기 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <label className="text-[14px] font-medium text-slate-900 dark:text-white">{t('publicMatch')}</label>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('publicMatchDesc')}</p>
              </div>
              <button
                onClick={() => setHostRoomVisibility(hostRoomVisibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
                className={`relative w-[42px] h-[26px] rounded-full transition-colors duration-200 flex-shrink-0 ${hostRoomVisibility === 'PUBLIC' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <div className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-transform duration-200 ${hostRoomVisibility === 'PUBLIC' ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          {/* 일정 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-6">
              <div
                onClick={() => setHostRoomActivePicker('START')}
                className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-40'}`}
              >
                <span className="text-[16px] font-black uppercase text-blue-500 mb-1">{t('startTime')}</span>
                <span className={`text-[16px] font-black ${hostRoomActivePicker === 'START' ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500'}`}>
                  {hostRoomDate.split('-').slice(1).join('.')} ({TRANSLATIONS[lang].days[new Date(hostRoomDate).getDay()]}) {hostRoomTime}
                </span>
              </div>
              <div className="text-slate-200 dark:text-slate-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </div>
              <div
                onClick={() => setHostRoomActivePicker('END')}
                className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-40'}`}
              >
                <span className="text-[16px] font-black uppercase text-rose-500 mb-1">{t('endTime')}</span>
                <span className={`text-[16px] font-black ${hostRoomActivePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                  {hostRoomEndDate.split('-').slice(1).join('.')} ({TRANSLATIONS[lang].days[new Date(hostRoomEndDate).getDay()]}) {hostRoomEndTime}
                </span>
              </div>
            </div>

            <div className="flex justify-center transition-all duration-300">
              {hostRoomActivePicker === 'START' ? (
                <DateTimePicker
                  date={hostRoomDate}
                  time={hostRoomTime}
                  onChange={(d, tm) => {
                    setHostRoomDate(d);
                    setHostRoomTime(tm);
                    const start = new Date(`${d}T${tm}`);
                    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
                    setHostRoomEndDate(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`);
                    setHostRoomEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
                  }}
                  lang={lang}
                  onViewModeChange={(mode) => setHostRoomIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                />
              ) : (
                <DateTimePicker
                  date={hostRoomEndDate}
                  time={hostRoomEndTime}
                  onChange={(d, t) => {
                    setHostRoomEndDate(d);
                    setHostRoomEndTime(t);
                  }}
                  lang={lang}
                  onViewModeChange={(mode) => setHostRoomIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 고정 수정 버튼 */}
      <div className="shrink-0 px-5 pt-3 pb-5 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => handleUpdateRoom(isProcessing, setIsProcessing, setCurrentPage, AppPageType)}
          disabled={isProcessing}
          className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-2xl text-[16px] font-bold tracking-tight shadow-lg shadow-slate-900/30 dark:shadow-white/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : t('editComplete')}
        </button>
      </div>
    </div>
  );
});
