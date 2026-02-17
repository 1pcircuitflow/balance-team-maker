import { useState, useCallback } from 'react';
import { BottomTabType, AppPageType, DetailPageTab, SportType } from '../types';

export interface ViewingApplicantData {
  name: string;
  tier: string;
  primaryPositions?: string[];
  secondaryPositions?: string[];
  tertiaryPositions?: string[];
  source?: string; // 'web' | undefined (host-added)
  userId?: string;
  sportType: SportType;
}

interface NavigationHistoryEntry {
  page: AppPageType;
  bottomTab: BottomTabType;
}

export const useNavigation = () => {
  const [currentBottomTab, setCurrentBottomTab] = useState<BottomTabType>(BottomTabType.HOME);
  const [currentPage, setCurrentPage] = useState<AppPageType>(AppPageType.HOME);
  const [detailTab, setDetailTab] = useState<DetailPageTab>(DetailPageTab.PENDING);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isNavigatingFromDetail, setIsNavigatingFromDetail] = useState<boolean>(false);

  // 히스토리 스택
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryEntry[]>([]);

  // 페이지 이동 시 현재 상태를 히스토리에 push하는 래퍼
  const navigateTo = useCallback((page: AppPageType, bottomTab?: BottomTabType) => {
    setNavigationHistory(prev => [...prev, { page: currentPage, bottomTab: currentBottomTab }]);
    setCurrentPage(page);
    if (bottomTab !== undefined) setCurrentBottomTab(bottomTab);
  }, [currentPage, currentBottomTab]);

  // 뒤로가기: 히스토리에서 pop
  const goBack = useCallback(() => {
    setNavigationHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const last = newHistory.pop()!;
      setCurrentPage(last.page);
      setCurrentBottomTab(last.bottomTab);
      return newHistory;
    });
  }, []);

  // 히스토리가 비어있는지 확인 (App.tsx 안드로이드 백버튼용)
  const isHistoryEmpty = useCallback(() => {
    return navigationHistory.length === 0;
  }, [navigationHistory]);

  const navigateToHome = useCallback(() => {
    setCurrentPage(AppPageType.HOME);
    setCurrentBottomTab(BottomTabType.HOME);
  }, []);

  const navigateToDetail = useCallback(() => {
    setCurrentPage(AppPageType.DETAIL);
  }, []);

  const navigateToBalance = useCallback(() => {
    setCurrentPage(AppPageType.BALANCE);
  }, []);

  const navigateToEditRoom = useCallback(() => {
    setCurrentPage(AppPageType.EDIT_ROOM);
  }, []);

  const navigateToMembersFromDetail = useCallback(() => {
    setNavigationHistory(prev => [...prev, { page: currentPage, bottomTab: currentBottomTab }]);
    setCurrentPage(AppPageType.HOME);
    setCurrentBottomTab(BottomTabType.MEMBERS);
    setIsNavigatingFromDetail(true);
  }, [currentPage, currentBottomTab]);

  const [viewingProfileUserId, setViewingProfileUserId] = useState<string | null>(null);
  const [viewingApplicantData, setViewingApplicantData] = useState<ViewingApplicantData | null>(null);

  const navigateToProfile = useCallback(() => {
    setNavigationHistory(prev => [...prev, { page: currentPage, bottomTab: currentBottomTab }]);
    setViewingProfileUserId(null);
    setViewingApplicantData(null);
    setCurrentPage(AppPageType.PROFILE);
  }, [currentPage, currentBottomTab]);

  const navigateToUserProfile = useCallback((userId: string, applicantData?: ViewingApplicantData) => {
    setNavigationHistory(prev => [...prev, { page: currentPage, bottomTab: currentBottomTab }]);
    setViewingProfileUserId(userId);
    setViewingApplicantData(applicantData || null);
    setCurrentPage(AppPageType.PROFILE);
  }, [currentPage, currentBottomTab]);

  const navigateToApplicantProfile = useCallback((data: ViewingApplicantData) => {
    setNavigationHistory(prev => [...prev, { page: currentPage, bottomTab: currentBottomTab }]);
    setViewingProfileUserId(null);
    setViewingApplicantData(data);
    setCurrentPage(AppPageType.PROFILE);
  }, [currentPage, currentBottomTab]);

  return {
    currentBottomTab, setCurrentBottomTab,
    currentPage, setCurrentPage,
    detailTab, setDetailTab,
    touchStartX, setTouchStartX,
    isNavigatingFromDetail, setIsNavigatingFromDetail,
    navigateToHome, navigateToDetail, navigateToBalance, navigateToEditRoom,
    navigateToMembersFromDetail, navigateToProfile,
    viewingProfileUserId, setViewingProfileUserId, navigateToUserProfile,
    viewingApplicantData, setViewingApplicantData, navigateToApplicantProfile,
    navigateTo, goBack, isHistoryEmpty,
    navigationHistory,
  };
};
