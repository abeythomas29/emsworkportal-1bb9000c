import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-gradient-primary text-primary-foreground border-transparent',
  secondary: 'bg-gradient-secondary text-secondary-foreground border-transparent',
  success: 'bg-success/5 border-success/30',
  warning: 'bg-warning/10 border-warning/30',
  destructive: 'bg-destructive/5 border-destructive/30',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  const isPrimary = variant === 'primary' || variant === 'secondary';

  return (
    <div
      className={cn('stat-card animate-fade-in group', variantStyles[variant], className)}
      role="figure"
      aria-label={`${title}: ${value}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-xs font-medium uppercase tracking-wider mb-2',
              isPrimary ? 'text-current/85' : 'text-muted-foreground'
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'font-display text-3xl md:text-[2rem] font-bold tabular-nums leading-none',
              isPrimary ? 'text-current' : 'text-foreground'
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p
              className={cn(
                'text-sm mt-2',
                isPrimary ? 'text-current/75' : 'text-muted-foreground'
              )}
            >
              {subtitle}
            </p>
          )}
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1.5 mt-3 text-xs font-semibold',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}
            >
              <span aria-hidden="true">{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal">vs last month</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'shrink-0 p-3 rounded-xl transition-transform duration-300 group-hover:scale-105',
              isPrimary ? 'bg-white/20 backdrop-blur-sm' : 'bg-primary/10 ring-1 ring-primary/15'
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
