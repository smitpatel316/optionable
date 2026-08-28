import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, RefreshCw, DollarSign, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { positionsApi } from '../../services/api';
import { PositionSellModal } from './PositionSellModal';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || '';

export const PositionsTable = ({ showToast, accountId, onPositionSold }) => {
    const [positions, setPositions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('open');
    const [sellingPosition, setSellingPosition] = useState(null);

    const fetchPositions = async () => {
        try {
            const params = {};
            if (accountId) params.accountId = accountId;
            if (filter !== 'all') params.status = filter;

            const [posData, summaryData] = await Promise.all([
                positionsApi.getAll(params),
                positionsApi.getSummary(accountId ? { accountId } : {})
            ]);

            if (posData.success) setPositions(posData.data);
            if (summaryData.success) setSummary(summaryData.data);
        } catch (error) {
            console.error('Error fetching positions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPrices = async () => {
        const openPositions = positions.filter(p => !p.soldDate);
        if (openPositions.length === 0) return;

        setRefreshing(true);
        try {
            const tickers = [...new Set(openPositions.map(p => p.ticker))];
            const res = await fetch(`${API_URL}/api/prices/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers })
            });
            const data = await res.json();
            if (data.success) {
                setPrices(data.data);
            }
        } catch (error) {
            console.error('Error fetching prices:', error);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, [filter, accountId]);

    useEffect(() => {
        if (positions.length > 0) {
            fetchPrices();
        }
    }, [positions.length]);

    const handleSell = async (data) => {
        try {
            await positionsApi.update(sellingPosition.id, data);
            setSellingPosition(null);
            showToast(`Sold ${sellingPosition.ticker} shares`, 'success');
            fetchPositions();
            if (onPositionSold) onPositionSold();
        } catch (error) {
            console.error('Error selling position:', error);
            showToast('Failed to sell position', 'error');
        }
    };

    const handleReopen = async (position) => {
        try {
            await positionsApi.update(position.id, { reopen: true });
            showToast(`Reopened ${position.ticker} position`, 'success');
            fetchPositions();
            if (onPositionSold) onPositionSold();
        } catch (error) {
            console.error('Error reopening position:', error);
            showToast('Failed to reopen position', 'error');
        }
    };

    const totalUnrealizedGL = positions
        .filter(p => !p.soldDate)
        .reduce((sum, p) => {
            const price = prices[p.ticker]?.price;
            if (!price) return sum;
            return sum + (price - p.costBasis) * p.shares;
        }, 0);

    if (loading) {
        return (
            <Card className="p-8">
                <div className="animate-spin w-6 h-6 border-2 border-foreground border-t-transparent rounded-full mx-auto"></div>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Stock Positions</h3>
                    {summary && (
                        <div className="flex items-center gap-3 ml-3 text-sm">
                            <span className="text-muted-foreground">
                                {summary.openPositions} open
                            </span>
                            {summary.realizedGainLoss !== 0 && (
                                <span className={cn('font-mono', pnlTone(summary.realizedGainLoss))}>
                                    Realized: {formatCurrency(summary.realizedGainLoss)}
                                </span>
                            )}
                            {totalUnrealizedGL !== 0 && (
                                <span className={cn('font-mono', pnlTone(totalUnrealizedGL))}>
                                    Unrealized: {formatCurrency(totalUnrealizedGL)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-muted rounded-md p-1 gap-0.5">
                        {['open', 'closed', 'all'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    'px-2 py-0.5 text-xs rounded-sm font-medium transition-colors capitalize',
                                    filter === f
                                        ? 'bg-background text-foreground shadow'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" size="sm" onClick={fetchPrices} disabled={refreshing}>
                        <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                        Prices
                    </Button>
                </div>
            </div>

            {/* Table */}
            {positions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                    No {filter !== 'all' ? filter : ''} positions. Positions are created when CSP trades are assigned.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table className="min-w-[560px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ticker</TableHead>
                                <TableHead className="text-right">Shares</TableHead>
                                <TableHead className="text-right">Cost Basis</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">P/L</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map(position => {
                                const currentPrice = position.soldDate ? position.salePrice : prices[position.ticker]?.price;
                                const gainLoss = position.soldDate
                                    ? position.capitalGainLoss
                                    : (currentPrice ? (currentPrice - position.costBasis) * position.shares : null);

                                return (
                                    <TableRow key={position.id}>
                                        <TableCell>
                                            <span className="font-medium text-foreground">{position.ticker}</span>
                                            <span className="block text-xs text-muted-foreground">{position.acquiredDate}</span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-foreground">
                                            {position.shares}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-foreground">
                                            ${position.costBasis.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {currentPrice ? (
                                                <span className="text-foreground">${currentPrice.toFixed(2)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">--</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {gainLoss !== null ? (
                                                <span className={cn('font-mono font-medium flex items-center justify-end gap-1', pnlTone(gainLoss))}>
                                                    {gainLoss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {formatCurrency(gainLoss)}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">--</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={position.soldDate ? 'muted' : 'outline'}>
                                                {position.soldDate ? 'Closed' : 'Open'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {!position.soldDate ? (
                                                <Button variant="secondary" size="sm" onClick={() => setSellingPosition(position)}>
                                                    <DollarSign className="w-3 h-3" />
                                                    Sell
                                                </Button>
                                            ) : (
                                                <Button variant="secondary" size="sm" onClick={() => handleReopen(position)}>
                                                    <RotateCcw className="w-3 h-3" />
                                                    Reopen
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Sell Modal */}
            <PositionSellModal
                isOpen={!!sellingPosition}
                onClose={() => setSellingPosition(null)}
                onSave={handleSell}
                position={sellingPosition}
            />
        </Card>
    );
};
