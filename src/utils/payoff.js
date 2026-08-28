// Payoff-at-expiry math (fork addition 2026-08-28). Pure functions, no React —
// kept separate so the numbers are unit-testable headlessly.
// All money in DOLLARS per share except where noted.

// Points for a short-option payoff: samples underlying prices around the
// strike and returns { points, breakeven, maxProfit, maxLoss }.
//   CSP short: pnl = entry − max(strike − S, 0)      BE = strike − entry
//   CC option leg: pnl = entry − max(S − strike, 0)  BE = strike + entry
// contracts multiplies into whole-dollar terms (×100 per contract).
export const shortOptionPayoff = ({ strike, entryPrice, contracts = 1, type = 'CSP' }) => {
    const mul = 100 * contracts;
    const breakeven = type === 'CSP' ? strike - entryPrice : strike + entryPrice;
    const lo = Math.max(0, breakeven - strike * 0.5);
    const hi = type === 'CSP' ? strike * 1.3 : strike * 1.6;
    const steps = 60;
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const s = lo + ((hi - lo) * i) / steps;
        const intrinsic = type === 'CSP' ? Math.max(strike - s, 0) : Math.max(s - strike, 0);
        const pnl = (entryPrice - intrinsic) * mul;
        points.push({ s: Math.round(s * 100) / 100, pnl: Math.round(pnl * 100) / 100 });
    }
    return {
        points,
        breakeven: Math.round(breakeven * 100) / 100,
        maxProfit: Math.round(entryPrice * mul * 100) / 100,
        maxLoss: type === 'CSP' ? Math.round((entryPrice - strike) * mul * 100) / 100 : null, // short-call loss unbounded
    };
};

// CC combined view with the underlying shares: pnl = (S − costBasis) − max(S − strike, 0) + entry
export const coveredCallCombinedPayoff = ({ strike, entryPrice, costBasis, contracts = 1 }) => {
    const mul = 100 * contracts;
    const breakeven = costBasis - entryPrice;
    const lo = Math.max(0, breakeven - costBasis * 0.6);
    const hi = strike * 1.5;
    const steps = 60;
    const points = [];
    for (let i = 0; i <= steps; i++) {
        const s = lo + ((hi - lo) * i) / steps;
        const pnl = ((s - costBasis) - Math.max(s - strike, 0) + entryPrice) * mul;
        points.push({ s: Math.round(s * 100) / 100, pnl: Math.round(pnl * 100) / 100 });
    }
    return {
        points,
        breakeven: Math.round(breakeven * 100) / 100,
        maxProfit: Math.round((strike - costBasis + entryPrice) * mul * 100) / 100,
        maxLoss: Math.round((entryPrice - costBasis) * mul * 100) / 100, // shares to zero
    };
};

// Estimate current underlying from the engine's distance field:
// positive otmPct = option is OTM by that %, negative = ITM.
//   put OTM:   S = strike × (1 + otm%)
//   put ITM:   S = strike × (1 + otm%)   (otm% negative — same formula)
//   call: mirror — OTM means S below strike.
export const estimateUnderlying = (strike, otmPct, type) => {
    if (otmPct == null || strike == null) return null;
    const f = 1 + Number(otmPct) / 100;
    const s = type === 'CC' ? strike / f : strike * f;
    return Math.round(s * 100) / 100;
};
