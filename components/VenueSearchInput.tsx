
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VenueData } from '../types';
import { searchPlaces, KakaoPlace } from '../services/kakaoMapService';
import { uploadVenuePhoto } from '../services/storageService';
import { getVenueInfo, saveVenueInfo } from '../services/firebaseService';
import { Z_INDEX } from '../constants';
import * as Icons from '../Icons';

interface VenueSearchInputProps {
  venue: string;
  setVenue: (v: string) => void;
  venueData: VenueData | null;
  setVenueData: (v: VenueData | null) => void;
  placeholder: string;
  t: (key: string, ...args: any[]) => string;
  darkMode?: boolean;
}

export const VenueSearchInput: React.FC<VenueSearchInputProps> = ({
  venue, setVenue, venueData, setVenueData, placeholder, t, darkMode,
}) => {
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // venueData에 photoUrl이 있으면 미리보기 설정
  useEffect(() => {
    if (venueData?.photoUrl) {
      setPreviewUrl(venueData.photoUrl);
    }
  }, [venueData?.photoUrl]);

  const handleSearch = useCallback((keyword: string) => {
    setVenue(keyword);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!keyword.trim()) {
      setResults([]);
      setIsDropdownOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const places = await searchPlaces(keyword);
      setResults(places);
      setIsDropdownOpen(places.length > 0);
    }, 300);
  }, [setVenue]);

  const handleSelectPlace = useCallback(async (place: KakaoPlace) => {
    setVenue(place.place_name);
    setIsDropdownOpen(false);
    setResults([]);

    // venues 컬렉션에서 기존 사진 조회
    const existingVenue = await getVenueInfo(place.id);
    const newVenueData: VenueData = {
      placeId: place.id,
      placeName: place.place_name,
      address: place.road_address_name || place.address_name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      ...(existingVenue?.photoUrl ? { photoUrl: existingVenue.photoUrl } : {}),
    };

    setVenueData(newVenueData);
    if (existingVenue?.photoUrl) {
      setPreviewUrl(existingVenue.photoUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [setVenue, setVenueData]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !venueData?.placeId) return;

    setIsUploading(true);
    try {
      const { photoUrl, thumbnailUrl } = await uploadVenuePhoto(venueData.placeId, file);

      // venues 컬렉션 업데이트
      await saveVenueInfo(venueData.placeId, {
        placeId: venueData.placeId,
        placeName: venueData.placeName,
        address: venueData.address,
        lat: venueData.lat,
        lng: venueData.lng,
        photoUrl,
        thumbnailUrl,
      });

      // 상태 업데이트
      setVenueData({ ...venueData, photoUrl, thumbnailUrl });
      setPreviewUrl(photoUrl);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setIsUploading(false);
      // 같은 파일 재선택 가능하도록 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [venueData, setVenueData]);

  const handleClearVenue = useCallback(() => {
    setVenue('');
    setVenueData(null);
    setPreviewUrl(null);
    setResults([]);
    setIsDropdownOpen(false);
  }, [setVenue, setVenueData]);

  return (
    <div ref={containerRef} className="flex-1 relative">
      {/* 검색 입력 */}
      <div className="relative">
        <input
          type="text"
          value={venue}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsDropdownOpen(true); }}
          placeholder={placeholder}
          className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 pr-8 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-semibold placeholder:text-[13px]"
        />
        {venue && (
          <button
            onClick={handleClearVenue}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition-all active:scale-90"
          >
            <Icons.CloseIcon />
          </button>
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      {isDropdownOpen && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden"
          style={{ zIndex: Z_INDEX.VENUE_AUTOCOMPLETE }}
        >
          {results.map((place) => (
            <button
              key={place.id}
              onClick={() => handleSelectPlace(place)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                {place.place_name}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {place.road_address_name || place.address_name}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* 장소 선택 후: 주소 + 사진 영역 */}
      {venueData && (
        <div className="mt-2 space-y-2">
          <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 px-1 truncate flex items-center gap-1">
            <Icons.LocationArrowIcon size={12} className="shrink-0 text-slate-400" />
            {venueData.address}
          </p>

          {/* 사진 영역 — DB 사진 있으면 크게 표시 / 없으면 업로드 유도 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full rounded-xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {previewUrl ? (
              /* DB에 사진이 있는 경우: 큰 썸네일 + 변경 안내 오버레이 */
              <div className="relative w-full h-24">
                <img
                  src={previewUrl}
                  alt={venueData.placeName}
                  className="w-full h-full object-cover"
                  onError={() => setPreviewUrl(null)}
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <span className="text-white text-[12px] font-medium">{t('tapToChangePhoto')}</span>
                </div>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              /* DB에 사진이 없는 경우: 점선 박스 + 업로드 유도 */
              <div className="w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-900/50">
                {isUploading ? (
                  <span className="inline-block w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Icons.CameraIcon size={24} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{t('tapToAddPhoto')}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-tight whitespace-pre-line px-4">{t('venuePhotoDesc')}</span>
                  </>
                )}
              </div>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};
