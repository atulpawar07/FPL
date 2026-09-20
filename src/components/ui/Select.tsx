import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, helperText, id, required, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs md:text-sm font-medium text-slate-300 flex items-center gap-1"
          >
            <span>{label}</span>
            {required && <span className="text-rose-400 font-bold">*</span>}
          </label>
        )}
        <div className="relative w-full">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full px-4 py-3 bg-slate-900/90 border rounded-xl text-slate-100 text-sm md:text-base appearance-none transition-all duration-200 focus:outline-none min-h-[46px] pr-10 cursor-pointer',
              error
                ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/40 bg-rose-950/10'
                : 'border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 hover:border-slate-700',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
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

Select.displayName = 'Select';
