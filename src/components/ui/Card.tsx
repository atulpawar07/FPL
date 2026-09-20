import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'interactive';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-900/90 border border-slate-800/80 shadow-xl shadow-slate-950/50',
      glass:
        'bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-slate-950/60',
      interactive:
        'bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all duration-200 hover:shadow-2xl hover:shadow-emerald-950/20 cursor-pointer',
    };

    return (
      <div
        ref={ref}
        className={clsx('rounded-2xl p-4 sm:p-6 md:p-8', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
