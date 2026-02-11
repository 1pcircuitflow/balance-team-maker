import { useState, useCallback } from 'react';
import { BottomTabType, AppPageType, DetailPageTab } from '../types';

export const useNavigation = () => {
  const [currentBottomTab, setCurrentBottomTab] = useState<BottomTabType>(BottomTabType.HOME);
  const [currentPage, setCurrentPage] = useState<AppPageType>(AppPageType.HOME);
  const [detailTab, setDetailTab] = useState<DetailPageTab>(DetailPageTab.PENDING);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isNavigatingFromDetail, setIsNavigatingFromDetail] = useState<boolean>(false);

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
    setCurrentPage(AppPageType.HOME);
    setCurrentBottomTab(BottomTabType.MEMBERS);
    setIsNavigatingFromDetail(true);
  }, []);

  return {
    currentBottomTab, setCurrentBottomTab,
    currentPage, setCurrentPage,
    detailTab, setDetailTab,
    touchStartX, setTouchStartX,
    isNavigatingFromDetail, setIsNavigatingFromDetail,
    navigateToHome, navigateToDetail, navigateToBalance, navigateToEditRoom,
    navigateToMembersFromDetail,
  };
};
