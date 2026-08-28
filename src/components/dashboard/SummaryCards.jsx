import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// The per-month and per-ticker stat tables that used to flank these tips were
// removed (2026-08-28): Monthly P/L was a third, cash-basis copy of Income ›
// Premium by Month, and Ticker P/L was a bare subset of Analytics › P/L
// Attribution by Underlying (which adds W/L, win rate, weighted ROI, and open
// exposure per name).

export const SummaryCards = () => {
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Wheel Strategy Tips</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <ul className="text-sm space-y-2 text-foreground list-disc pl-4">
                    <li>Sell CSPs on red days.</li>
                    <li>Sell CCs on green days.</li>
                    <li>Avoid earnings weeks if conservative.</li>
                    <li>Don't wheel stocks you don't want to own!</li>
                </ul>
            </CardContent>
        </Card>
    );
};
