// Shared gain/loss tone — the ONLY hue in the app is data: emerald gain, rose loss.
export const pnlTone = (value) =>
    (value ?? 0) >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

export const pnlBg = (value) =>
    (value ?? 0) >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10';
