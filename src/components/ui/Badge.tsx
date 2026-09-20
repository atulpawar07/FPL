import React from 'react';
import { clsx } from 'clsx';
import { RegistrationStatus, PaymentStatus } from '@/types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: RegistrationStatus | PaymentStatus | string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  status,
  variant,
  children,
  ...props
}) => {
  let resolvedVariant = variant || 'neutral';

  if (status) {
    switch (status) {
      case 'SUCCESSFUL':
      case 'CONFIRMED':
      case 'ACTIVE':
        resolvedVariant = 'success';
        break;
      case 'WAITING_LIST':
        resolvedVariant = 'info';
        break;
      case 'PENDING':
      case 'DRAFT':
        resolvedVariant = 'warning';
        break;
      case 'FAILED':
      case 'CANCELLED':
      case 'INACTIVE':
        resolvedVariant = 'error';
        break;
      case 'REFUNDED':
        resolvedVariant = 'neutral';
        break;
    }
  }

  const variants = {
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    warning: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    error: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
    info: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border tracking-wide uppercase',
        variants[resolvedVariant],
        className
      )}
      {...props}
    >
      {children || status}
    </span>
  );
};
