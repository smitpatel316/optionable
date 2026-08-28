import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
    <input
        type={type}
        className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className
        )}
        ref={ref}
        {...props}
    />
));
Input.displayName = 'Input';

const Label = React.forwardRef(({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-xs font-medium text-muted-foreground leading-none', className)} {...props} />
));
Label.displayName = 'Label';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
    <textarea
        className={cn(
            'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className
        )}
        ref={ref}
        {...props}
    />
));
Textarea.displayName = 'Textarea';

export { Input, Label, Textarea };
