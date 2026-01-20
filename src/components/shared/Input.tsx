import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-slate-900 dark:text-white text-sm font-medium">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-lg border ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/20'
        } bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-0 focus:ring-2 px-4 py-3.5 text-base font-normal ${className}`}
        {...props}
      />
      {error && (
        <p className="text-red-500 text-xs">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-gray-400 dark:text-gray-500 text-xs">{helperText}</p>
      )}
    </div>
  );
};

