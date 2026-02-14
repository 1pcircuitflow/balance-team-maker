
import React, { useEffect, useRef } from 'react';
import { Z_INDEX } from '../constants';

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  isVisible: boolean;
  bottom?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, actionLabel, onAction, onDismiss, isVisible, bottom }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed left-4 right-4 flex justify-center animate-in slide-in-from-bottom-4 duration-300" style={{ zIndex: Z_INDEX.TOAST, bottom: bottom || '96px' }}>
      <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 shadow-2xl max-w-sm w-full">
        <span className="text-[14px] font-medium">{message}</span>
        {actionLabel && onAction && (
          <button
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              onAction();
            }}
            className="text-[14px] font-bold text-emerald-400 dark:text-emerald-600 shrink-0 active:scale-95 transition-transform"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
