
import React, { useState } from 'react';
import { SportType, UserProfile, UserSportProfile, Position } from '../../types';
import { Z_INDEX } from '../../constants';
import { useAppContext } from '../../contexts/AppContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { FormationPicker } from '../FormationPicker';

const SPORT_OPTIONS: { type: SportType; emoji: string }[] = [
  { type: SportType.SOCCER, emoji: '\u26BD' },
  { type: SportType.FUTSAL, emoji: '\u{1F945}' },
  { type: SportType.BASKETBALL, emoji: '\u{1F3C0}' },
  { type: SportType.GENERAL, emoji: '\u{1F3BE}' },
];

const TIER_COLORS: Record<string, { active: string; dark: string }> = {
  S: { active: 'bg-purple-100 text-purple-700 border-purple-200 shadow-lg shadow-purple-500/10', dark: 'dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  A: { active: 'bg-rose-50 text-rose-700 border-rose-100 shadow-lg shadow-rose-500/10', dark: 'dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' },
  B: { active: 'bg-blue-50 text-blue-700 border-blue-100 shadow-lg shadow-blue-500/10', dark: 'dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  C: { active: 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-lg shadow-emerald-500/10', dark: 'dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  D: { active: 'bg-amber-50 text-amber-700 border-amber-200 shadow-lg shadow-amber-500/10', dark: 'dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
};

export const OnboardingModal: React.FC = () => {
  const { t, lang, darkMode } = useAppContext();
  const { updateAndSaveProfile, isAdFree } = useAuthContext();

  const [step, setStep] = useState(0);
  const [selectedSports, setSelectedSports] = useState<SportType[]>([]);
  const [profiles, setProfiles] = useState<Partial<Record<SportType, UserSportProfile>>>({});
  const [saving, setSaving] = useState(false);
  const [showTierGuide, setShowTierGuide] = useState(false);
  const [showPosGuide, setShowPosGuide] = useState(false);

  const toggleSport = (sport: SportType) => {
    setSelectedSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    );
  };

  const currentSport = step > 0 ? selectedSports[step - 1] : null;
  const currentProfile = currentSport ? (profiles[currentSport] || {
    tier: 'B',
    primaryPositions: [],
    secondaryPositions: [],
    tertiaryPositions: [],
    forbiddenPositions: [],
  }) : null;

  const updateCurrentProfile = (updates: Partial<UserSportProfile>) => {
    if (!currentSport) return;
    setProfiles(prev => ({
      ...prev,
      [currentSport]: { ...(prev[currentSport] || { tier: 'B', primaryPositions: [], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] }), ...updates },
    }));
  };

  const handleNext = async () => {
    if (step === 0) {
      if (selectedSports.length === 0) return;
      setStep(1);
    } else if (step < selectedSports.length) {
      setStep(step + 1);
    } else {
      setSaving(true);
      const profile: UserProfile = {
        sports: profiles,
        onboardingComplete: true,
      };
      await updateAndSaveProfile(profile);
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const totalSteps = selectedSports.length + 1;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div
      className={`fixed inset-0 flex flex-col animate-in fade-in duration-300 ${darkMode ? 'bg-slate-950' : 'bg-white'}`}
      style={{
        zIndex: Z_INDEX.ALERT_MODAL - 1,
        paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
        paddingBottom: isAdFree ? 'env(safe-area-inset-bottom, 0px)' : 'calc(56px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full bg-blue-500 transition-all duration-1000 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header — HostRoomModal 상단 바와 동일 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        {step > 0 ? (
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        ) : <div className="w-10" />}
        <h2 className="text-[16px] font-black text-slate-900 dark:text-white">
          {step === 0 ? t('onboardingTitle') : t('setTierAndPosition')}
        </h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {step === 0 ? (
          /* Step 0: 종목 선택 — 카드형 그리드 */
          <div className="space-y-4">
            <p className="text-[13px] font-medium text-center text-slate-400 dark:text-slate-500">
              {t('selectSportsDesc')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {SPORT_OPTIONS.map(({ type, emoji }) => {
                const isSelected = selectedSports.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleSport(type)}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <span className="text-[32px]">{emoji}</span>
                    <span className={`text-[14px] font-bold ${isSelected ? 'text-blue-500' : 'text-slate-600 dark:text-slate-300'}`}>
                      {t(type.toLowerCase() as any)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : currentSport && currentProfile ? (
          /* Step 1~N: 종목별 설정 — DetailPage 편집 모드와 동일 구조 */
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[14px] font-bold text-slate-900 dark:text-white">
                {t(currentSport.toLowerCase() as any)}
              </span>
              <span className="text-[12px] text-slate-400">
                ({step}/{selectedSports.length})
              </span>
            </div>

            {/* Tier */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTierGuide(true)}
                  className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >?</button>
                <label className="text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('tierLabel')}</label>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['S', 'A', 'B', 'C', 'D'].map(v => {
                  const isActive = currentProfile.tier === v;
                  const colors = TIER_COLORS[v];
                  return (
                    <button
                      key={v}
                      onClick={() => updateCurrentProfile({ tier: v })}
                      className={`py-2 rounded-xl font-black text-sm border transition-all ${
                        isActive
                          ? `${colors.active} ${colors.dark}`
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FormationPicker */}
            {currentSport !== SportType.GENERAL && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowPosGuide(true)}
                    className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >?</button>
                  <label className="text-[12px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('positionLabel')}</label>
                </div>
                <FormationPicker
                  sport={currentSport}
                  primaryP={currentProfile.primaryPositions as Position[]}
                  secondaryP={currentProfile.secondaryPositions as Position[]}
                  tertiaryP={currentProfile.tertiaryPositions as Position[]}
                  forbiddenP={currentProfile.forbiddenPositions as Position[]}
                  lang={lang}
                  onChange={(p, s, tr, f) => updateCurrentProfile({
                    primaryPositions: p,
                    secondaryPositions: s,
                    tertiaryPositions: tr,
                    forbiddenPositions: f,
                  })}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Tier Guide Modal */}
      {showTierGuide && (
        <div className="fixed inset-0 flex items-center justify-center p-6 animate-in fade-in duration-200" style={{ zIndex: Z_INDEX.ALERT_MODAL }}>
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowTierGuide(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t('tierGuideTitle')}</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t('tierGuideDesc')}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
                <span className="text-base font-black text-purple-600 dark:text-purple-400">S</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('tierSDesc')}</p>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50">
                <span className="text-base font-black text-rose-600 dark:text-rose-400">A</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('tierADesc')}</p>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                <span className="text-base font-black text-blue-600 dark:text-blue-400">B</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('tierBDesc')}</p>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">C</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('tierCDesc')}</p>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50">
                <span className="text-base font-black text-amber-600 dark:text-amber-400">D</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('tierDDesc')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowTierGuide(false)}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm transition-all active:scale-95"
            >{t('confirm')}</button>
          </div>
        </div>
      )}

      {/* Position Guide Modal */}
      {showPosGuide && (
        <div className="fixed inset-0 flex items-center justify-center p-6 animate-in fade-in duration-200" style={{ zIndex: Z_INDEX.ALERT_MODAL }}>
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowPosGuide(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t('posGuideTitle')}</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t('posGuideDesc')}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">100</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('pos100Desc')}</p>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/50">
                <span className="text-sm font-black text-yellow-600 dark:text-yellow-400">75</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('pos75Desc')}</p>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50">
                <span className="text-sm font-black text-orange-600 dark:text-orange-400">50</span>
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{t('pos50Desc')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowPosGuide(false)}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm transition-all active:scale-95"
            >{t('confirm')}</button>
          </div>
        </div>
      )}

      {/* Bottom button — HostRoomModal 하단 생성 버튼과 동일 */}
      <div className="shrink-0 px-5 pt-3 pb-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={handleNext}
          disabled={step === 0 ? selectedSports.length === 0 : saving}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-2xl text-[16px] font-bold tracking-tight shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 disabled:opacity-50"
        >
          {saving ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : step < selectedSports.length ? (
            t('next')
          ) : step === 0 ? (
            t('next')
          ) : (
            t('onboardingComplete')
          )}
        </button>
      </div>
    </div>
  );
};
