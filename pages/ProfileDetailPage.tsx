import React, { useState, useRef, useEffect } from 'react';
import { SportType, Position, UserSportProfile, UserProfile, Tier } from '../types';
import { Z_INDEX, TIER_BADGE_COLORS } from '../constants';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { FormationPicker } from '../components/FormationPicker';
import { uploadProfilePhoto } from '../services/storageService';
import { updateNicknameInRooms, saveUserNickname, loadUserProfile, loadUserNickname } from '../services/firebaseService';
import { ArrowLeftIcon, CameraIcon } from '../Icons';
import * as Icons from '../Icons';

const { EditIcon, CheckIcon } = Icons;

const SPORT_OPTIONS: { type: SportType; emoji: string }[] = [
  { type: SportType.SOCCER, emoji: '\u26BD' },
  { type: SportType.FUTSAL, emoji: '\u{1F945}' },
  { type: SportType.BASKETBALL, emoji: '\u{1F3C0}' },
  { type: SportType.GENERAL, emoji: '\u{1F3BE}' },
];

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ProfileDetailPage: React.FC = React.memo(() => {
  const { t, lang, showAlert, showConfirm } = useAppContext();
  const { user, currentUserId, userNickname, setUserNickname, isAdFree, userProfile, updateAndSaveProfile, handleLogout } = useAuthContext();
  const { setPlayers, setIsDataLoaded } = usePlayerContext();
  const { viewingProfileUserId, setViewingProfileUserId, goBack } = useNavigationContext();

  const isViewingOther = !!viewingProfileUserId;

  const [editingSport, setEditingSport] = useState<SportType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(userNickname);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 타인 프로필 상태
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [otherNickname, setOtherNickname] = useState<string>('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    if (!viewingProfileUserId) return;
    setIsLoadingProfile(true);
    Promise.all([
      loadUserProfile(viewingProfileUserId),
      loadUserNickname(viewingProfileUserId),
    ]).then(([profile, nickname]) => {
      setOtherProfile(profile);
      setOtherNickname(nickname || '');
    }).finally(() => setIsLoadingProfile(false));
  }, [viewingProfileUserId]);

  const displayProfile = isViewingOther ? otherProfile : userProfile;
  const displayNickname = isViewingOther ? otherNickname : userNickname;
  const displayPhotoUrl = isViewingOther ? otherProfile?.photoUrl : userProfile?.photoUrl;

  const onUpdateNickname = (name: string) => {
    setUserNickname(name);
    localStorage.setItem('app_user_nickname', name);
    if (currentUserId) {
      saveUserNickname(currentUserId, name);
      updateNicknameInRooms(currentUserId, name);
    }
  };

  const handleNicknameSave = () => {
    const trimmed = nicknameInput.trim();
    if (trimmed) {
      onUpdateNickname(trimmed);
    }
    setEditingNickname(false);
  };

  const onLogout = () => showConfirm(t('logoutConfirm'), () => handleLogout(setPlayers, setIsDataLoaded), t('logoutTitle'));

  const photoUrl = userProfile?.photoUrl || null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    e.target.value = '';

    setUploading(true);
    try {
      const url = await uploadProfilePhoto(currentUserId, file);
      const updated = { ...userProfile!, photoUrl: url };
      await updateAndSaveProfile(updated);
    } catch (err) {
      console.error('Profile photo upload failed:', err);
      showAlert(t('photoUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleResetPhoto = async () => {
    setShowPhotoMenu(false);
    const updated = { ...userProfile! };
    delete updated.photoUrl;
    await updateAndSaveProfile(updated);
  };

  return (
    <div className="fixed left-0 right-0 top-0 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden"
      style={{ zIndex: Z_INDEX.PAGE_OVERLAY, bottom: isAdFree ? '0px' : '80px' }}>
      {/* Header */}
      <header className="w-full pt-[40px] pb-[8px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-950 shrink-0">
        <div className="flex justify-between items-center px-4 w-full">
          <button
            onClick={() => {
              if (isViewingOther) setViewingProfileUserId(null);
              goBack();
            }}
            className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
          >
            <ArrowLeftIcon size={24} />
          </button>
          <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
            {t('profileDetail')}
          </h3>
          <div className="w-8" />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6"
        style={{ paddingBottom: isAdFree ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>

        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-20">
            <span className="inline-block w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (<>

        {/* Profile Photo + Nickname */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="w-[72px] h-[72px] rounded-full bg-[#eaeef4] dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {displayPhotoUrl ? (
                <img src={displayPhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[12px] font-medium text-slate-400 dark:text-slate-400">BELO</span>
              )}
            </div>
            {!isViewingOther && (
              <>
                <button
                  onClick={() => setShowPhotoMenu(true)}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-[26px] h-[26px] rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CameraIcon size={14} />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </>
            )}
            {/* Photo menu popover */}
            {showPhotoMenu && (
              <>
                <div className="fixed inset-0" style={{ zIndex: Z_INDEX.PAGE_OVERLAY + 1 }} onClick={() => setShowPhotoMenu(false)} />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden whitespace-nowrap"
                  style={{ zIndex: Z_INDEX.PAGE_OVERLAY + 2 }}>
                  {displayPhotoUrl && (
                    <button
                      onClick={handleResetPhoto}
                      className="w-full px-5 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-200 text-left transition-all active:bg-slate-50 dark:active:bg-slate-700 border-b border-slate-100 dark:border-slate-700"
                    >
                      {t('resetToDefaultPhoto')}
                    </button>
                  )}
                  <button
                    onClick={() => { setShowPhotoMenu(false); fileInputRef.current?.click(); }}
                    className="w-full px-5 py-3 text-[13px] font-medium text-blue-500 text-left transition-all active:bg-slate-50 dark:active:bg-slate-700"
                  >
                    {t('selectFromAlbum')}
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="text-[16px] font-semibold text-slate-900 dark:text-white">{displayNickname}</span>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-200 dark:bg-slate-700" />

        {/* My Skill Profile Section */}
        <div>
          <div className="px-1 pb-2">
            <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('mySkillProfile')}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
            {displayProfile?.sports && Object.keys(displayProfile.sports).length > 0 ? (
              <>
                {(Object.entries(displayProfile.sports) as [SportType, UserSportProfile][]).map(([sport, profile]) => (
                  <div key={sport}>
                    {isViewingOther ? (
                      <div className="w-full px-5 py-3.5 flex items-center border-b border-slate-100 dark:border-slate-800 text-left">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[14px] shrink-0">{SPORT_OPTIONS.find(s => s.type === sport)?.emoji}</span>
                          <span className="text-[12px] font-medium text-slate-900 dark:text-white shrink-0">{t(sport.toLowerCase() as any)}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium shrink-0 ${TIER_BADGE_COLORS[Tier[profile.tier as keyof typeof Tier] as unknown as Tier] || ''}`}>
                            {profile.tier}
                          </span>
                          {sport !== SportType.GENERAL && (
                            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                              {(profile.primaryPositions || []).map((pos: string, i: number) => (
                                <div key={`p-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-emerald-500 uppercase shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>{pos}</span>
                                </div>
                              ))}
                              {(profile.secondaryPositions || []).map((pos: string, i: number) => (
                                <div key={`s-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-yellow-400 uppercase shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                  <span>{pos}</span>
                                </div>
                              ))}
                              {(profile.tertiaryPositions || []).map((pos: string, i: number) => (
                                <div key={`t-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-orange-400 uppercase shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                  <span>{pos}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                    <>
                    <button
                      type="button"
                      className="w-full px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 text-left"
                      onClick={() => setEditingSport(editingSport === sport ? null : sport)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[14px] shrink-0">{SPORT_OPTIONS.find(s => s.type === sport)?.emoji}</span>
                        <span className="text-[12px] font-medium text-slate-900 dark:text-white shrink-0">{t(sport.toLowerCase() as any)}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium shrink-0 ${TIER_BADGE_COLORS[Tier[profile.tier as keyof typeof Tier] as unknown as Tier] || ''}`}>
                          {profile.tier}
                        </span>
                        {sport !== SportType.GENERAL && (
                          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                            {(profile.primaryPositions || []).map((pos: string, i: number) => (
                              <div key={`p-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-emerald-500 uppercase shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{pos}</span>
                              </div>
                            ))}
                            {(profile.secondaryPositions || []).map((pos: string, i: number) => (
                              <div key={`s-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-yellow-400 uppercase shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                <span>{pos}</span>
                              </div>
                            ))}
                            {(profile.tertiaryPositions || []).map((pos: string, i: number) => (
                              <div key={`t-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-orange-400 uppercase shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                <span>{pos}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <ChevronIcon open={editingSport === sport} />
                    </button>
                    {editingSport === sport && (
                      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Tier */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {['S', 'A', 'B', 'C', 'D'].map(v => (
                            <button
                              key={v}
                              onClick={() => {
                                const updated = { ...userProfile!, sports: { ...userProfile!.sports, [sport]: { ...profile, tier: v } } };
                                updateAndSaveProfile(updated);
                              }}
                              className={`py-2 rounded-xl font-medium text-[11px] transition-all ${profile.tier === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        {/* Position picker (not for General) */}
                        {sport !== SportType.GENERAL && (
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-2">
                            <FormationPicker
                              sport={sport}
                              primaryP={(profile.primaryPositions || []) as Position[]}
                              secondaryP={(profile.secondaryPositions || []) as Position[]}
                              tertiaryP={(profile.tertiaryPositions || []) as Position[]}
                              forbiddenP={(profile.forbiddenPositions || []) as Position[]}
                              lang={lang}
                              onChange={(p, s, tr, f) => {
                                const updated = { ...userProfile!, sports: { ...userProfile!.sports, [sport]: { ...profile, primaryPositions: p, secondaryPositions: s, tertiaryPositions: tr, forbiddenPositions: f } } };
                                updateAndSaveProfile(updated);
                              }}
                            />
                          </div>
                        )}
                        {/* Remove sport */}
                        <button
                          onClick={() => {
                            const newSports = { ...userProfile!.sports };
                            delete newSports[sport];
                            updateAndSaveProfile({ ...userProfile!, sports: newSports });
                            setEditingSport(null);
                          }}
                          className="w-full py-2 text-[12px] font-medium text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl transition-all active:scale-[0.98]"
                        >
                          {t('removeSport')}
                        </button>
                      </div>
                    )}
                    </>
                    )}
                  </div>
                ))}
                {/* Add sport button (only for own profile) */}
                {!isViewingOther && Object.keys(displayProfile.sports).length < 4 && (
                  <div className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {SPORT_OPTIONS.filter(s => !displayProfile.sports?.[s.type]).map(({ type, emoji }) => (
                        <button
                          key={type}
                          onClick={() => {
                            const newProfile = {
                              ...userProfile,
                              sports: {
                                ...userProfile!.sports,
                                [type]: { tier: 'B', primaryPositions: [], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
                              },
                            };
                            updateAndSaveProfile(newProfile);
                            setEditingSport(type);
                          }}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[12px] font-medium text-slate-500 dark:text-slate-400 transition-all active:scale-95 flex items-center gap-1"
                        >
                          <span>+</span> {emoji} {t(type.toLowerCase() as any)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="px-5 py-4">
                <p className="text-[12px] text-slate-400 mb-3">{t('noProfileYet')}</p>
                {!isViewingOther && (
                <div className="flex flex-wrap gap-2">
                  {SPORT_OPTIONS.map(({ type, emoji }) => (
                    <button
                      key={type}
                      onClick={() => {
                        const newProfile = {
                          sports: { [type]: { tier: 'B', primaryPositions: [], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] } },
                          onboardingComplete: true,
                          photoUrl: userProfile?.photoUrl,
                        };
                        updateAndSaveProfile(newProfile);
                        setEditingSport(type);
                      }}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[12px] font-medium text-slate-500 dark:text-slate-400 transition-all active:scale-95 flex items-center gap-1"
                    >
                      <span>+</span> {emoji} {t(type.toLowerCase() as any)}
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Account section (only for own profile) */}
        {!isViewingOther && (<>
        {/* Divider */}
        <div className="h-px bg-slate-200 dark:bg-slate-700" />

        {/* Section: Account */}
        <div>
          <div className="px-1 pb-2">
            <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsAccount')}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
            {/* Account Type */}
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('accountType')}</span>
              <span className="text-[12px] text-slate-400">{user ? (user.provider === 'kakao' ? t('kakaoAccount') : t('googleAccount')) : t('guestMode')}</span>
            </div>
            {/* Nickname */}
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('nickname')}</span>
              {editingNickname ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={e => setNicknameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNicknameSave(); }}
                    className="w-32 px-2 py-1 text-[14px] text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-lg text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button onClick={handleNicknameSave} className="text-emerald-500 p-1">
                    <CheckIcon />
                  </button>
                </div>
              ) : (
                <button type="button" className="flex items-center gap-2 cursor-pointer" onClick={() => { setNicknameInput(userNickname); setEditingNickname(true); }} aria-label={t('nickname')}>
                  <span className="text-[12px] text-slate-400">{userNickname}</span>
                  <span className="text-slate-300 dark:text-slate-600"><EditIcon /></span>
                </button>
              )}
            </div>
            {/* Logout */}
            <div className="px-5 py-3">
              <button
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-[12px] font-medium text-slate-900 dark:text-white transition-all active:scale-[0.98]"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
        </>)}

        </>)}
      </div>
    </div>
  );
});
