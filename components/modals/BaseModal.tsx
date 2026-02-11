import React from 'react';

interface BaseModalProps {
  isOpen: boolean;
  onClose?: () => void;
  zIndex?: number;
  maxWidth?: string;
  children: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, zIndex = 2000, maxWidth = 'max-w-sm', children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className={`w-full ${maxWidth}`}>
        {children}
      </div>
    </div>
  );
};
