import React from 'react';
import { formatCurrency } from '../../utils/formatters';

// Portfolio risk & Greeks summary (fork addition 2026-08-28). Aggregates the
// open wheel book into seller-fluency numbers: net delta, theta pace,
// remaining premium, collateral at risk, and time-to-expiry pressure.
// Data: GET /api/analytics/risk (open trades + engine-pushed open positions).

const Card = ({ label, value, subtext, valueClassName = '', title }) => (
    <div
        className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[88px]"
        title={title}
    >
        <span className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</span>
        <div className={`text-2xl font-bold font-mono mt-1 ${valueClassName}`}>{value}</div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</div>
    </div>
);

const fmtSigned = (v) => `${v > 0 ? '+' : ''}${formatCurrency(v)}`;

export const RiskPanel = ({ risk }) => {
    if (!risk || risk.openCount === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-400">
                No open positions — portfolio risk panel is empty until the next trade opens.
            </div>
        );
    }

    const plClass = (v) => (v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400');
    const asOf = risk.asOf ? `as of ${new Date(risk.asOf.includes('T') ? risk.asOf : `${risk.asOf.replace(' ', 'T')}Z`).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : 'from trade log';

    return (
        <section>
            <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Portfolio Risk &amp; Greeks</h3>
                <span className="text-xs text-slate-400">{risk.openCount} open · {risk.source === 'engine-push' ? asOf : 'no engine push yet — entry snapshot'}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card
                    label="Net Δ"
                    value={risk.netDelta != null ? `${risk.netDelta > 0 ? '+' : ''}${risk.netDelta.toFixed(1)}` : '—'}
                    valueClassName={risk.netDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : risk.netDelta < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}
                    subtext={`${risk.deltaCoverage}/${risk.openCount} trades carry entry delta`}
                    title="Share-equivalent deltas at entry: short put = +delta, short call = −delta. Entry snapshot, not live."
                />
                <Card
                    label="Est. θ / day"
                    value={risk.thetaPerDayEstimate != null ? fmtSigned(risk.thetaPerDayEstimate) : '—'}
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                    subtext="linear decay of remaining premium"
                    title="Estimated daily income pace if positions drift to expiry OTM: remaining extrinsic ÷ days to expiry. Rough estimate."
                />
                <Card
                    label="Premium remaining"
                    value={risk.premiumRemaining != null ? formatCurrency(risk.premiumRemaining) : '—'}
                    valueClassName="text-indigo-600 dark:text-indigo-400"
                    subtext={`collected: ${formatCurrency(risk.premiumCollected)}`}
                    title="Cost to buy back all open options at their last engine mark."
                />
                <Card
                    label="Unrealized P/L"
                    value={risk.unrealizedPL != null ? fmtSigned(risk.unrealizedPL) : '—'}
                    valueClassName={risk.unrealizedPL != null ? plClass(risk.unrealizedPL) : ''}
                    subtext={risk.itmCount ? `${risk.itmCount} position${risk.itmCount !== 1 ? 's' : ''} ITM` : 'all OTM at last mark'}
                />
                <Card
                    label="Next expiry"
                    value={risk.nearestExpiryDays != null ? `${risk.nearestExpiryDays}d` : '—'}
                    valueClassName={risk.nearestExpiryDays != null && risk.nearestExpiryDays < 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}
                    subtext={risk.dteHotCount ? `${risk.dteHotCount} expiring < 7d` : 'nothing expiring < 7d'}
                />
            </div>
        </section>
    );
};
