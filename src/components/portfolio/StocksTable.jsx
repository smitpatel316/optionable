import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, ArrowRightLeft, ChevronDown, ChevronRight, RefreshCw, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { StockModal } from './StockModal';

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
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            {/* Header - matches TradeTable style */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/50">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    Stock Positions
                </h3>
                <div className="flex items-center gap-3">
                    {/* Status Filter Tabs */}
                    <div className="flex bg-muted rounded-lg p-0.5">
                        {STATUS_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setFilter(tab.key); setExpandedTicker(null); }}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                    filter === tab.key
                                        ? 'bg-card dark:bg-secondary text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'
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
                            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:bg-accent dark:hover:bg-accent rounded transition-colors"
                        >
                            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                            Prices
                        </button>
                    )}
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {aggregated.length} tickers · {filteredStocks.length} lots
                    </span>
                    <button
                        onClick={() => { setEditingStock(null); setIsSelling(false); setShowModal(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
                        title="Buy stock"
                    >
                        <Plus className="w-4 h-4" />
                        Buy Stock
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted border-b border-border">
                        <tr>
                            <th className="px-3 py-2 font-semibold w-8"></th>
                            <th className="px-3 py-2 font-semibold">Ticker</th>
                            <th className="px-3 py-2 font-semibold text-right">Shares</th>
                            <th className="px-3 py-2 font-semibold text-right">Avg Cost</th>
                            {filter !== 'closed' && (
                                <th className="px-3 py-2 font-semibold text-right">Current</th>
                            )}
                            <th className="px-3 py-2 font-semibold text-right">P/L</th>
                            <th className="px-3 py-2 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {aggregated.length === 0 ? (
                            <tr>
                                <td colSpan={filter !== 'closed' ? 7 : 6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                    {stocks.length === 0
                                        ? 'No stock positions yet. Click "Buy Stock" to track manual purchases.'
                                        : `No ${filter !== 'all' ? filter : ''} stock positions.`
                                    }
                                </td>
                            </tr>
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
                                        <tr
                                            className={`hover:bg-accent/80 dark:hover:bg-accent/50 transition-colors ${group.lots.length > 1 ? 'cursor-pointer' : ''}`}
                                            onClick={() => group.lots.length > 1 && setExpandedTicker(isExpanded ? null : group.ticker)}
                                        >
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {group.lots.length > 1 ? (
                                                    isExpanded
                                                        ? <ChevronDown className="w-4 h-4" />
                                                        : <ChevronRight className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-transparent" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="font-medium text-foreground">{group.ticker}</span>
                                                {group.lots.length > 1 && (
                                                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                                                        {group.lots.length} lots
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-foreground">
                                                {group.totalShares}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-foreground">
                                                {formatCurrency(group.avgCostBasis)}
                                            </td>
                                            {filter !== 'closed' && (
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {currentPrice ? (
                                                        <span className="text-foreground">{formatCurrency(currentPrice)}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground dark:text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-3 py-2 text-right">
                                                {displayPL !== null ? (
                                                    <span className={`font-mono font-medium inline-flex items-center gap-1 ${displayPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {displayPL >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                        {formatCurrency(displayPL)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground dark:text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {/* Actions for single-lot tickers (show inline) */}
                                                {group.lots.length === 1 && (
                                                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {!group.isClosed && (
                                                            <button
                                                                onClick={() => { setEditingStock(group.lots[0]); setIsSelling(true); setShowModal(true); }}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-amber-400 hover:bg-muted dark:hover:bg-amber-900/30 rounded transition-colors"
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
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                                                            title="Delete this stock"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            <span>Delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Expanded lot details */}
                                        {isExpanded && group.lots.map(lot => {
                                            const lotPL = lot.soldDate
                                                ? lot.capitalGainLoss
                                                : (currentPrice ? (currentPrice - lot.costBasis) * lot.shares : null);

                                            return (
                                                <tr key={lot.id} className="bg-muted/50 dark:bg-secondary/30 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors">
                                                    <td className="px-3 py-2"></td>
                                                    <td className="px-3 py-2">
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
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-muted-foreground">
                                                        {lot.shares}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-muted-foreground">
                                                        {formatCurrency(lot.costBasis)}
                                                    </td>
                                                    {filter !== 'closed' && (
                                                        <td className="px-3 py-2 text-right text-xs font-mono text-muted-foreground">
                                                            {lot.soldDate && lot.salePrice !== null
                                                                ? formatCurrency(lot.salePrice)
                                                                : ''
                                                            }
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 text-right">
                                                        {lotPL !== null && (
                                                            <span className={`text-xs font-mono font-medium ${lotPL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {formatCurrency(lotPL)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {!lot.soldDate && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingStock(lot); setIsSelling(true); setShowModal(true); }}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-amber-400 hover:bg-muted dark:hover:bg-amber-900/30 rounded transition-colors"
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
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                                                                title="Delete this lot"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                <span>Delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
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
        </div>
    );
};
