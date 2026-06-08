import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

interface ConfirmOptions {
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    confirm: (message: string, options: ConfirmOptions) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;
function generateId() {
  idCounter += 1;
  return `toast-${Date.now()}-${idCounter}`;
}

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel: string;
    cancelLabel: string;
  } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = DEFAULT_DURATION) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type, duration, createdAt: Date.now() }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const toast = useMemo(
    () => ({
      success: (message: string, duration?: number) =>
        addToast(message, 'success', duration ?? DEFAULT_DURATION),
      error: (message: string, duration?: number) =>
        addToast(message, 'error', duration ?? DEFAULT_DURATION),
      info: (message: string, duration?: number) =>
        addToast(message, 'info', duration ?? DEFAULT_DURATION),
      confirm: (message: string, options: ConfirmOptions) => {
        setConfirmState({
          message,
          onConfirm: options.onConfirm,
          onCancel: () => {
            options.onCancel?.();
            setConfirmState(null);
          },
          confirmLabel: options.confirmLabel ?? 'Confirm',
          cancelLabel: options.cancelLabel ?? 'Cancel',
        });
      },
    }),
    [addToast]
  );

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.onConfirm();
      setConfirmState(null);
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.onCancel();
    }
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast container: top-right, above all UI (including modals) */}
      <div
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-3 w-full max-w-[min(420px,calc(100vw-2rem))] sm:max-w-md isolate"
        style={{ pointerEvents: 'none' }}
        aria-live="polite"
        aria-label="Notifications"
      >
        <div className="flex flex-col gap-3 pointer-events-auto" style={{ pointerEvents: 'auto' }}>
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>
      </div>
      {confirmState && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto"
          onClick={handleCancel}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="confirm-title" className="text-slate-800 dark:text-slate-100 font-medium mb-6">
              {confirmState.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const styles: Record<ToastType, { bg: string; border: string; icon: string; iconBg: string }> = {
    success: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-l-4 border-emerald-500',
      icon: 'check_circle',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    error: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-l-4 border-red-500',
      icon: 'error',
      iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400',
    },
    info: {
      bg: 'bg-white dark:bg-slate-800',
      border: 'border-l-4 border-primary',
      icon: 'info',
      iconBg: 'bg-primary/15 text-primary',
    },
  };

  const s = styles[item.type];

  return (
    <div
      role="alert"
      className={`${s.bg} ${s.border} rounded-xl pl-4 pr-3 py-3.5 flex items-start gap-3 min-w-[280px] max-w-full transition-all duration-300 ease-out border border-slate-200 dark:border-slate-600 shadow-xl ring-1 ring-black/5 dark:ring-white/10 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <span className={`material-symbols-outlined flex-shrink-0 mt-0.5 rounded-full p-1.5 text-[20px] ${s.iconBg}`}>
        {s.icon}
      </span>
      <p className="flex-1 text-[15px] font-medium leading-snug text-slate-800 dark:text-slate-100 pt-0.5">{item.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Close notification"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}

const noop = () => {};
const noopToast = {
  success: noop,
  error: noop,
  info: noop,
  confirm: (_m: string, opts: ConfirmOptions) => opts.onCancel?.(),
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { toast: noopToast, removeToast: noop };
  }
  return ctx;
}
