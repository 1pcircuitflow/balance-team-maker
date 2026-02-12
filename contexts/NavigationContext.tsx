import React, { createContext, useContext, useState, useCallback } from 'react';
import { BottomTabType, AppPageType, DetailPageTab, SportType } from '../types';
import { useNavigation } from '../hooks/useNavigation';

interface NavigationContextValue {
  // From useNavigation
  currentBottomTab: BottomTabType;
  setCurrentBottomTab: (tab: BottomTabType) => void;
  currentPage: AppPageType;
  setCurrentPage: (page: AppPageType) => void;
  detailTab: DetailPageTab;
  setDetailTab: (tab: DetailPageTab) => void;
  touchStartX: number | null;
  setTouchStartX: (v: number | null) => void;
  isNavigatingFromDetail: boolean;
  setIsNavigatingFromDetail: (v: boolean) => void;
  navigateToHome: () => void;
  navigateToDetail: () => void;
  navigateToBalance: () => void;
  navigateToEditRoom: () => void;
  navigateToMembersFromDetail: () => void;
  // activeTab state
  activeTab: SportType;
  setActiveTab: (tab: SportType) => void;
  changeTab: (tab: SportType) => void;
}

const NavigationContext = createContext<NavigationContextValue>(null!);

export const useNavigationContext = () => useContext(NavigationContext);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const nav = useNavigation();

  const [activeTab, setActiveTab] = useState<SportType>(() => {
    const saved = localStorage.getItem('last_active_tab');
    return (saved as SportType) || SportType.GENERAL;
  });

  const changeTab = useCallback((tab: SportType) => {
    setActiveTab(tab);
    nav.setCurrentPage(AppPageType.HOME);
    localStorage.setItem('last_active_tab', tab);
  }, [nav]);

  // Persist activeTab to localStorage
  // (changeTab already does this, but direct setActiveTab calls also need persistence)

  return (
    <NavigationContext.Provider value={{
      ...nav,
      activeTab,
      setActiveTab,
      changeTab,
    }}>
      {children}
    </NavigationContext.Provider>
  );
};
