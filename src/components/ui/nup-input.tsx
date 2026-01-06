import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatNUP } from '@/lib/nupMask';
import { cn } from '@/lib/utils';

interface NUPInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export const NUPInput = React.forwardRef<HTMLInputElement, NUPInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatNUP(e.target.value);
      onChange(formatted);
    };

    return (
      <Input
        ref={ref}
        value={value}
        onChange={handleChange}
        placeholder="62000.001753/2025-56"
        className={cn(className)}
        {...props}
      />
    );
  }
);

NUPInput.displayName = 'NUPInput';
