import React from 'react';
import { Z_INDEX } from '../constants';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppContext } from '../contexts/AppContext';

export const OfflineBanner: React.FC = React.memo(() => {
  const isOnline = useNetworkStatus();
  const { t } = useAppContext();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-rose-500 text-white text-center py-2 px-4 text-[12px] font-semibold animate-in slide-in-from-top duration-300" style={{ zIndex: Z_INDEX.OFFLINE_BANNER, paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
      {t('offlineMsg')}
    </div>
  );
});
