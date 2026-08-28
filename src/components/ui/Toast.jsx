import React from 'react';
import { Check, X } from 'lucide-react';

export const Toast = ({ toast, onClose }) => {
    if (!toast) return null;

    const getTypeClasses = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-popover border-emerald-500/40 text-emerald-700 dark:text-emerald-300';
            case 'error':
                return 'bg-popover border-rose-500/40 text-rose-600 dark:text-rose-400';
            default:
                return 'bg-popover text-popover-foreground';
        }
    };

    return (
        <div className={`fixed bottom-4 right-4 z-[80] px-4 py-3 rounded-md shadow-lg border flex items-center gap-2 animate-in slide-in-from-bottom-2 ${getTypeClasses()}`}>
            {toast.type === 'success' && <Check className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
