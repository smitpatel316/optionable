import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roiOnDeployedCapital } from './calculations.js';

const NOW = new Date('2026-08-31T17:00:00');

test('realized over deployed with linear monthly/annualized rates', () => {
    const r = roiOnDeployedCapital(746.5, 94050, '2026-08-05', NOW);
    assert.equal(r.daysActive, 26);
    assert.ok(Math.abs(r.roi - 0.7937) < 0.001, `roi ${r.roi}`);
    assert.ok(Math.abs(r.monthly - 0.9291) < 0.001, `monthly ${r.monthly}`);
    assert.ok(Math.abs(r.annualized - 11.1455) < 0.01, `annualized ${r.annualized}`);
});

test('zero deployed capital guards to 0.00%', () => {
    const r = roiOnDeployedCapital(500, 0, '2026-08-05', NOW);
    assert.equal(r.roi, 0);
    assert.equal(r.monthly, 0);
    assert.equal(r.annualized, 0);
    assert.equal(r.daysActive, 26);
});

test('no trades yet: daysActive 0 and rates 0', () => {
    const r = roiOnDeployedCapital(0, 5000, null, NOW);
    assert.deepEqual([r.roi, r.monthly, r.annualized, r.daysActive], [0, 0, 0, 0]);
});

test('same-day trades clamp daysActive to 1 (no runaway annualized)', () => {
    const r = roiOnDeployedCapital(10, 5000, '2026-08-31', NOW);
    assert.equal(r.daysActive, 1);
    assert.ok(Math.abs(r.roi - 0.2) < 1e-9);
});
