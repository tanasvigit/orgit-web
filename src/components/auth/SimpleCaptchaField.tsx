import React, { useCallback, useEffect, useState } from 'react';
import { authService } from '../../services/authService';

type SimpleCaptchaFieldProps = {
  captchaId: string;
  captchaCode: string;
  value: string;
  onChange: (value: string) => void;
  onCaptchaLoaded: (payload: { captchaId: string; code: string }) => void;
  onRefresh?: () => void;
  disabled?: boolean;
  error?: string | null;
};

export const SimpleCaptchaField: React.FC<SimpleCaptchaFieldProps> = ({
  captchaId,
  captchaCode,
  value,
  onChange,
  onCaptchaLoaded,
  onRefresh,
  disabled = false,
  error,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    onChange('');
    try {
      const data = await authService.getRegisterCaptcha();
      if (!data?.captchaId || !data?.code) {
        throw new Error('Failed to load captcha');
      }
      onCaptchaLoaded({ captchaId: data.captchaId, code: data.code });
    } catch (err: any) {
      setLoadError(err?.response?.data?.error || err?.message || 'Failed to load captcha');
    } finally {
      setLoading(false);
    }
  }, [onCaptchaLoaded, onChange]);

  useEffect(() => {
    if (!captchaId) {
      loadCaptcha();
    }
  }, [captchaId, loadCaptcha]);

  return (
    <label className="flex flex-col min-w-40 flex-1">
      <p className="text-slate-900 dark:text-white text-base font-medium leading-normal pb-2">
        Security code
      </p>
      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex h-14 min-w-[140px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 px-4 font-mono text-2xl font-bold tracking-[0.35em] text-slate-800 select-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          aria-hidden
          onCopy={(e) => e.preventDefault()}
        >
          {loading ? '...' : captchaCode || '-----'}
        </div>
        <button
          type="button"
          onClick={() => {
            onRefresh?.();
            loadCaptcha();
          }}
          disabled={disabled || loading}
          className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Refresh captcha"
          title="Refresh captcha"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^23456789A-Z]/gi, '').slice(0, 5))}
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        disabled={disabled || loading || !captchaId}
        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/20 focus:border-primary h-14 placeholder:text-slate-400 p-[15px] text-lg font-mono font-semibold tracking-widest uppercase"
        placeholder="Type code here"
        maxLength={5}
      />
      {loadError ? <p className="text-red-500 text-sm mt-1">{loadError}</p> : null}
      {error ? <p className="text-red-500 text-sm mt-1">{error}</p> : null}
    </label>
  );
};
