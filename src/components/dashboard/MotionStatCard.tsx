import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface MotionStatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning';
  className?: string;
  index?: number;
  children?: React.ReactNode;
}

const variantStyles = {
  default: 'bg-card hover:bg-card/80',
  primary: 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20',
  accent: 'bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border-accent/20',
  success: 'bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/20',
  warning: 'bg-gradient-to-br from-warning/10 via-warning/5 to-transparent border-warning/20',
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

export function MotionStatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
  className,
  index = 0,
  children,
}: MotionStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ 
        y: -4, 
        scale: 1.02,
        transition: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group relative overflow-hidden rounded-xl p-5 border shadow-sm cursor-default',
        variantStyles[variant],
        className
      )}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.08 + 0.2, duration: 0.4, type: 'spring' }}
            className={cn(
              'text-3xl font-bold tracking-tight',
              valueVariantStyles[variant]
            )}
          >
            {value}
          </motion.p>
          {description && (
            <p className="text-xs text-muted-foreground mt-2">{description}</p>
          )}
          {children}
        </div>
        <motion.div
          whileHover={{ scale: 1.15, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400 }}
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            iconVariantStyles[variant]
          )}
        >
          <Icon className="w-6 h-6" />
        </motion.div>
      </div>
    </motion.div>
  );
}
