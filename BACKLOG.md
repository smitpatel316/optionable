# Backlog

Known issues, improvements, and planned work. Items are pulled from here into version milestones.

---

## Follow-ups from v0.18 analytics work

- **Live Greeks (gamma/vega/IV, % chance of profit)** — the risk panel currently uses entry delta + linear theta. True gamma/vega and OptionStrat-style POP need live option-chain Greeks forwarded by the engine push (new fields in the `/api/engine/dashboard` blob; sync protocol unchanged in v0.18 deliberately).
- **Earnings/event markers on the expiry ladder** — annotate expirations overlapping earnings dates (Finnhub earnings cache already lives wheel-stack side; needs the engine to include an `events` array in its dashboard push).
- **Per-cycle chart drill-down** — click a Wheel Cycle row to see its legs on a timeline (roll credits on and off).
- **Attribution: include realized share-lot gains** when share lots are recorded (currently option-premium only; symbol-level capital gains from `positions.capitalGainLoss` would make it complete for stock-heavy cycles).

- Live underlying lookup for payoff diagrams currently derives spot from the engine's distance field; a direct engine-pushed `underlyingPrice` would remove the estimate.

