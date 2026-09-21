import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold tracking-wide rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] min-h-[44px] touch-manipulation select-none';

    const variants = {
      primary:
        'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/60 border border-emerald-400/40 hover:shadow-emerald-500/25',
      gold:
        'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-bold shadow-lg shadow-amber-950/60 border border-amber-300/60 hover:shadow-amber-500/30',
      secondary:
        'bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 border border-slate-700 shadow-md backdrop-blur-sm',
      outline:
        'bg-slate-900/40 hover:bg-slate-800/60 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400 backdrop-blur-sm',
      ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/40 border border-rose-500/30',
    };

    const sizes = {
      sm: 'px-3 py-2 text-xs md:text-sm min-h-[38px]',
      md: 'px-5 py-2.5 text-sm md:text-base min-h-[46px]',
      lg: 'px-6 py-3.5 text-base md:text-lg min-h-[52px]',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : leftIcon ? (
          <span className="mr-2 inline-flex items-center">{leftIcon}</span>
        ) : null}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="ml-2 inline-flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
