import React from 'react';
import { SportType, AppPageType } from '../types';
import { TRANSLATIONS } from '../translations';
import { DateTimePicker } from '../components/DateTimePicker';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { ArrowLeftIcon, CheckIcon } = Icons;

export const EditRoomPage: React.FC = React.memo(() => {
  const { t, lang } = useAppContext();
  const { isProcessing, setIsProcessing } = useAuthContext();
  const { setCurrentPage } = useNavigationContext();
  const {
    hostRoomSelectedSport, setHostRoomSelectedSport,
    hostRoomTitle, setHostRoomTitle,
    hostRoomVenue, setHostRoomVenue,
    hostRoomDate, setHostRoomDate, hostRoomTime, setHostRoomTime,
    hostRoomEndDate, setHostRoomEndDate, hostRoomEndTime, setHostRoomEndTime,
    hostRoomUseLimit, setHostRoomUseLimit,
    hostRoomMaxApplicants, setHostRoomMaxApplicants,
    hostRoomActivePicker, setHostRoomActivePicker,
    setHostRoomIsPickerSelectionMode,
    handleUpdateRoom,
  } = useRecruitmentContext();
  return (
    <div className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
        <button
          onClick={() => setCurrentPage(AppPageType.DETAIL)}
          className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
        >
          <ArrowLeftIcon size={24} />
        </button>
        <h2 className="text-base font-black text-slate-900 dark:text-white">{t('editMatch')}</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-[148px]">
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('sport')}</label>
              <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 py-1">
                {[SportType.GENERAL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL].map((s) => (
                  <button
                    key={s}
                    onClick={() => setHostRoomSelectedSport(s)}
                    className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border ${hostRoomSelectedSport === s
                      ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                      : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'
                      }`}
                  >
                    {t(s.toLowerCase())}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('roomTitle')}</label>
              <input
                type="text"
                value={hostRoomTitle}
                onChange={(e) => setHostRoomTitle(e.target.value)}
                placeholder={t('inputRoomTitle')}
                className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('venue')}</label>
              <input
                type="text"
                value={hostRoomVenue}
                onChange={(e) => setHostRoomVenue(e.target.value)}
                placeholder={t('venuePlaceholder')}
                className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
              />
            </div>
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  onClick={() => setHostRoomActivePicker('START')}
                  className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                >
                  <span className="text-[16px] font-black uppercase text-blue-500 mb-1">{t('startTime')}</span>
                  <span className={`text-[16px] font-black ${hostRoomActivePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
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
                    onChange={(d, t) => {
                      setHostRoomDate(d);
                      setHostRoomTime(t);
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

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('limitApplicants')}</label>
                <button
                  onClick={() => setHostRoomUseLimit(!hostRoomUseLimit)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${hostRoomUseLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hostRoomUseLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {hostRoomUseLimit && (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl px-2 py-1 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-2">
                  <button onClick={() => setHostRoomMaxApplicants(Math.max(2, hostRoomMaxApplicants - 1))} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 12H4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <span className="text-center font-black dark:text-white text-[12px] min-w-[40px]">{t('peopleCount', hostRoomMaxApplicants)}</span>
                  <button onClick={() => setHostRoomMaxApplicants(hostRoomMaxApplicants + 1)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setCurrentPage(AppPageType.DETAIL)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-xl transition-all active:scale-[0.95]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => handleUpdateRoom(isProcessing, setIsProcessing, setCurrentPage, AppPageType)}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.95] shadow-md shadow-blue-500/20"
            >
              {isProcessing ? '...' : t('editComplete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
