import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
  className?: string;
  index?: number;
}

const variantStyles = {
  default: 'bg-card hover:bg-card/80',
  primary: 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:border-primary/40',
  accent: 'bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border-accent/20 hover:border-accent/40',
  success: 'bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/20 hover:border-success/40',
  warning: 'bg-gradient-to-br from-warning/10 via-warning/5 to-transparent border-warning/20 hover:border-warning/40',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary shadow-sm shadow-primary/20',
  accent: 'bg-accent/15 text-accent shadow-sm shadow-accent/20',
  success: 'bg-success/15 text-success shadow-sm shadow-success/20',
  warning: 'bg-warning/15 text-warning shadow-sm shadow-warning/20',
};

const valueVariantStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
  className,
  index = 0,
}: StatCardProps) {
  return (
    <div 
      className={cn(
        'group relative overflow-hidden rounded-xl p-5 border shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        variantStyles[variant], 
        className
      )}
      style={{ 
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn(
            'text-3xl font-bold tracking-tight transition-colors duration-300',
            valueVariantStyles[variant]
          )}>
            {value}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              {description}
            </p>
          )}
        </div>
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110',
          iconVariantStyles[variant]
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
