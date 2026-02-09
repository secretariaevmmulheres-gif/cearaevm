import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  dotColor?: string;
  children: ReactNode;
  className?: string;
  colSpan?: 1 | 2;
  delay?: number;
  action?: ReactNode;
}

export function ChartCard({ 
  title, 
  dotColor = 'bg-primary', 
  children, 
  className,
  colSpan = 1,
  delay = 0,
  action,
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1, ease: 'easeOut' }}
      whileHover={{ y: -2, boxShadow: '0 12px 30px -8px rgba(0,0,0,0.12)' }}
      className={cn(
        'chart-card',
        colSpan === 2 && 'lg:col-span-2',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="chart-title">
          <div className={cn('chart-title-dot', dotColor)} />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </motion.div>
  );
}
