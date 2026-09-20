import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className={clsx(
          'w-full bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl shadow-slate-950 max-h-[90vh] overflow-y-auto transform transition-all duration-300 animate-slideUp sm:animate-scaleUp',
          maxWidths[maxWidth]
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
          {title && <h3 className="text-lg font-bold text-slate-100">{title}</h3>}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
