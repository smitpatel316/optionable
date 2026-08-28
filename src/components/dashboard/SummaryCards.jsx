import React from 'react';

// The per-month and per-ticker stat tables that used to flank these tips were
// removed (2026-08-28): Monthly P/L was a third, cash-basis copy of Income ›
// Premium by Month, and Ticker P/L was a bare subset of Analytics › P/L
// Attribution by Underlying (which adds W/L, win rate, weighted ROI, and open
// exposure per name).

export const SummaryCards = () => {
    return (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 p-4">
            <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-300 mb-3">Wheel Strategy Tips</h4>
            <ul className="text-sm space-y-2 text-indigo-700 dark:text-indigo-400 list-disc pl-4">
                <li>Sell CSPs on red days.</li>
                <li>Sell CCs on green days.</li>
                <li>Avoid earnings weeks if conservative.</li>
                <li>Don't wheel stocks you don't want to own!</li>
            </ul>
        </div>
    );
};
