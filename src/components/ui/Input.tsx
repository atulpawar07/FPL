import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs md:text-sm font-medium text-slate-300 flex items-center gap-1"
          >
            <span>{label}</span>
            {required && <span className="text-rose-400 font-bold">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full px-4 py-3 bg-slate-900/90 border rounded-xl text-slate-100 text-sm md:text-base placeholder-slate-500 transition-all duration-200 focus:outline-none min-h-[46px]',
            error
              ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/40 bg-rose-950/10'
              : 'border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 hover:border-slate-700',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs md:text-sm text-rose-400 font-medium animate-fadeIn">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
