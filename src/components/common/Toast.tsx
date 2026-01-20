import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, visible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible) return null;

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }[type];

  const icon = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  }[type];

  return (
    <>
      <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
        <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[500px]`}>
          <span className="material-icons-outlined flex-shrink-0">{icon}</span>
          <span className="flex-1 font-medium text-sm">{message}</span>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <span className="material-icons-outlined text-lg">close</span>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

