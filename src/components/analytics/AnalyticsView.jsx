import React, { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../../services/api';
import { RiskPanel } from './RiskPanel';
import { ExposureLadder } from './ExposureLadder';
import { AttributionPanel } from './AttributionPanel';
import { CyclesPanel } from './CyclesPanel';

// Analytics tab (fork addition 2026-08-28): advanced views derived server-side
// from the trades table + engine-pushed positions blob. Fetches on mount and
// whenever the selected account changes.

export const AnalyticsView = ({ accountId }) => {
    const [risk, setRisk] = useState(null);
    const [exposure, setExposure] = useState(null);
    const [attribution, setAttribution] = useState(null);
    const [cycles, setCycles] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [riskRes, exposureRes, attributionRes, cyclesRes] = await Promise.all([
                analyticsApi.getRisk(accountId),
                analyticsApi.getExposure(accountId),
                analyticsApi.getAttribution(accountId),
                analyticsApi.getCycles(accountId),
            ]);
            setRisk(riskRes.data);
            setExposure(exposureRes.data);
            setAttribution(attributionRes.data);
            setCycles(cyclesRes.data.cycles);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [accountId]);

    useEffect(() => { load(); }, [load]);

    if (loading && !risk) {
        return <div className="text-slate-400 text-sm py-8 text-center">Loading analytics…</div>;
    }
    if (error) {
        return <div className="text-red-500 text-sm py-8 text-center">Analytics unavailable: {error}</div>;
    }

    return (
        <div className="space-y-6">
            <RiskPanel risk={risk} />
            <ExposureLadder exposure={exposure} />
            <AttributionPanel attribution={attribution} />
            <CyclesPanel cycles={cycles} />
        </div>
    );
};
