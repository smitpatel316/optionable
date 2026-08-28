import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, ArrowRightLeft, ChevronDown, ChevronRight, RefreshCw, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { StockModal } from './StockModal';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || '';

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const num = Number(value);
    const sign = num >= 0 ? '' : '-';
    return `${sign}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_TABS = [
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
    { key: 'all', label: 'All' }
];

export const StocksTable = ({ stocks, onCreate, onUpdate, onDelete, showToast, selectedAccountId, accounts, buyTrigger }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingStock, setEditingStock] = useState(null);
    const [isSelling, setIsSelling] = useState(false);
    const [filter, setFilter] = useState('open');
    const [expandedTicker, setExpandedTicker] = useState(null);
    const [prices, setPrices] = useState({});
    const [refreshing, setRefreshing] = useState(false);

    // Open buy modal when triggered externally (e.g. from header button)
    useEffect(() => {
        if (buyTrigger > 0) {
            setEditingStock(null);
            setIsSelling(false);
            setShowModal(true);
        }
    }, [buyTrigger]);

    const filteredStocks = stocks.filter(s => {
        if (filter === 'open') return !s.soldDate;
        if (filter === 'closed') return !!s.soldDate;
        return true;
    });

    // Aggregate stocks by ticker
    const aggregated = useMemo(() => {
        const groups = {};
        for (const stock of filteredStocks) {
            const key = stock.ticker;
            if (!groups[key]) {
                groups[key] = { ticker: key, lots: [], totalShares: 0, totalCost: 0, isClosed: !!stock.soldDate, totalGainLoss: 0 };
            }
            groups[key].lots.push(stock);
            groups[key].totalShares += stock.shares;
            groups[key].totalCost += stock.costBasis * stock.shares;
            if (stock.capitalGainLoss !== null && stock.capitalGainLoss !== undefined) {
                groups[key].totalGainLoss += stock.capitalGainLoss;
            }
        }

        return Object.values(groups).map(g => ({
            ...g,
            avgCostBasis: g.totalShares > 0 ? g.totalCost / g.totalShares : 0,
            lots: g.lots.sort((a, b) => new Date(a.acquiredDate) - new Date(b.acquiredDate))
        })).sort((a, b) => a.ticker.localeCompare(b.ticker));
    }, [filteredStocks]);

    // Fetch live prices for open tickers
    const fetchPrices = async () => {
        const openTickers = aggregated
            .filter(g => !g.isClosed)
            .map(g => g.ticker);
        if (openTickers.length === 0) return;

        setRefreshing(true);
        try {
            const res = await fetch(`${API_URL}/api/prices/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers: openTickers })
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
        if (aggregated.length > 0 && filter !== 'closed') {
            fetchPrices();
        }
    }, [aggregated.length, filter]);

    const handleSave = async (data) => {
        try {
            if (isSelling && editingStock) {
                await onUpdate(editingStock.id, data);
                showToast?.('Stock sold', 'success');
            } else if (editingStock) {
                await onUpdate(editingStock.id, data);
                showToast?.('Stock updated', 'success');
            } else {
                await onCreate(data);
                showToast?.('Stock added', 'success');
            }
            setShowModal(false);
            setEditingStock(null);
            setIsSelling(false);
        } catch (err) {
            showToast?.('Failed to save stock', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this stock lot?')) return;
        try {
            await onDelete(id);
            showToast?.('Stock deleted', 'success');
        } catch (err) {
            showToast?.('Failed to delete stock', 'error');
        }
    };

    return (
        <Card className="overflow-hidden">
            {/* Header - matches TradeTable style */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/50">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    Stock Positions
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Status Filter Tabs */}
                    <div className="flex bg-muted rounded-md p-1 gap-0.5">
                        {STATUS_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setFilter(tab.key); setExpandedTicker(null); }}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                    filter === tab.key
                                        ? 'bg-background text-foreground shadow'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {filter !== 'closed' && (
                        <button
                            onClick={fetchPrices}
                            disabled={refreshing}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        >
                            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                            Prices
                        </button>
                    )}
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {aggregated.length} tickers · {filteredStocks.length} lots
                    </span>
                    <Button
                        size="sm"
                        onClick={() => { setEditingStock(null); setIsSelling(false); setShowModal(true); }}
                        title="Buy stock"
                    >
                        <Plus className="w-4 h-4" />
                        Buy Stock
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-muted/50">
                            <TableHead className=" w-8"></TableHead>
                            <TableHead className="">Ticker</TableHead>
                            <TableHead className="text-right">Shares</TableHead>
                            <TableHead className="text-right">Avg Cost</TableHead>
                            {filter !== 'closed' && (
                                <TableHead className="text-right">Current</TableHead>
                            )}
                            <TableHead className="text-right">P/L</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {aggregated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={filter !== 'closed' ? 7 : 6} className="py-12 text-center text-sm text-muted-foreground">
                                    {stocks.length === 0
                                        ? 'No stock positions yet. Click "Buy Stock" to track manual purchases.'
                                        : `No ${filter !== 'all' ? filter : ''} stock positions.`
                                    }
                                </TableCell>
                            </TableRow>
                        ) : (
                            aggregated.map(group => {
                                const isExpanded = expandedTicker === group.ticker;
                                const currentPrice = prices[group.ticker]?.price;
                                const unrealizedPL = !group.isClosed && currentPrice
                                    ? (currentPrice - group.avgCostBasis) * group.totalShares
                                    : null;
                                const displayPL = group.isClosed ? group.totalGainLoss : unrealizedPL;

                                return (
                                    <React.Fragment key={group.ticker}>
                                        {/* Aggregated ticker row */}
                                        <TableRow
                                            className={group.lots.length > 1 ? 'cursor-pointer' : undefined}
                                            onClick={() => group.lots.length > 1 && setExpandedTicker(isExpanded ? null : group.ticker)}
                                        >
                                            <TableCell className="text-muted-foreground">
                                                {group.lots.length > 1 ? (
                                                    isExpanded
                                                        ? <ChevronDown className="w-4 h-4" />
                                                        : <ChevronRight className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-transparent" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-medium text-foreground">{group.ticker}</span>
                                                {group.lots.length > 1 && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                                                        {group.lots.length} lots
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-foreground">
                                                {group.totalShares}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-foreground">
                                                {formatCurrency(group.avgCostBasis)}
                                            </TableCell>
                                            {filter !== 'closed' && (
                                                <TableCell className="text-right font-mono">
                                                    {currentPrice ? (
                                                        <span className="text-foreground">{formatCurrency(currentPrice)}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground dark:text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                {displayPL !== null ? (
                                                    <span className={`font-mono font-medium inline-flex items-center gap-1 ${pnlTone(displayPL)}`}>
                                                        {displayPL >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                        {formatCurrency(displayPL)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground dark:text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {/* Actions for single-lot tickers (show inline) */}
                                                {group.lots.length === 1 && (
                                                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {!group.isClosed && (
                                                            <button
                                                                onClick={() => { setEditingStock(group.lots[0]); setIsSelling(true); setShowModal(true); }}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                                                title="Sell shares"
                                                            >
                                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                                                <span>Sell</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setEditingStock(group.lots[0]); setIsSelling(false); setShowModal(true); }}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-accent rounded transition-colors"
                                                            title="Edit stock details"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            <span>Edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(group.lots[0].id)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                                            title="Delete this stock"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            <span>Delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded lot details */}
                                        {isExpanded && group.lots.map(lot => {
                                            const lotPL = lot.soldDate
                                                ? lot.capitalGainLoss
                                                : (currentPrice ? (currentPrice - lot.costBasis) * lot.shares : null);

                                            return (
                                                <TableRow key={lot.id} className="bg-muted/40">
                                                    <TableCell></TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 pl-4">
                                                            <span className="text-muted-foreground dark:text-muted-foreground mr-1">└</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {lot.acquiredDate}
                                                                {lot.soldDate && (
                                                                    <span className="ml-1 text-muted-foreground">
                                                                        → {lot.soldDate}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {lot.notes && (
                                                                <span className="ml-1 text-[10px] text-muted-foreground italic truncate max-w-[120px]">
                                                                    {lot.notes}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                                        {lot.shares}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                                        {formatCurrency(lot.costBasis)}
                                                    </TableCell>
                                                    {filter !== 'closed' && (
                                                        <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                                            {lot.soldDate && lot.salePrice !== null
                                                                ? formatCurrency(lot.salePrice)
                                                                : ''
                                                            }
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="text-right">
                                                        {lotPL !== null && (
                                                            <span className={`text-xs font-mono font-medium ${pnlTone(lotPL)}`}>
                                                                {formatCurrency(lotPL)}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {!lot.soldDate && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingStock(lot); setIsSelling(true); setShowModal(true); }}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                                                    title="Sell shares"
                                                                >
                                                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                                                    <span>Sell</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingStock(lot); setIsSelling(false); setShowModal(true); }}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-accent rounded transition-colors"
                                                                title="Edit stock details"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                <span>Edit</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(lot.id); }}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                                                title="Delete this lot"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>Delete</span>
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <StockModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingStock(null); setIsSelling(false); }}
                onSave={handleSave}
                editingStock={editingStock}
                isSelling={isSelling}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
            />
        </Card>
    );
};
