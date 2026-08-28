import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

export const StockModal = ({ isOpen, onClose, onSave, editingStock, isSelling, accounts, selectedAccountId }) => {
    const [formData, setFormData] = useState({});

    // Reset form when modal opens or editing context changes
    useEffect(() => {
        if (isSelling && editingStock) {
            setFormData({
                sharesToSell: editingStock.shares,
                soldDate: new Date().toISOString().split('T')[0],
                salePrice: '',
            });
        } else if (editingStock) {
            setFormData({
                ticker: editingStock.ticker || '',
                shares: editingStock.shares || '',
                costBasis: editingStock.costBasis || '',
                acquiredDate: editingStock.acquiredDate || '',
                notes: editingStock.notes || '',
            });
        } else {
            setFormData({
                ticker: '',
                shares: '',
                costBasis: '',
                acquiredDate: new Date().toISOString().split('T')[0],
                notes: '',
                accountId: '',
            });
        }
    }, [editingStock, isSelling, isOpen]);

    if (!isOpen) return null;

    const needsAccountPicker = !selectedAccountId && !editingStock;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSelling) {
            const sharesToSell = Number(formData.sharesToSell);
            const data = {
                soldDate: formData.soldDate,
                salePrice: Number(formData.salePrice),
            };
            // Include sharesToSell so backend knows if partial
            if (sharesToSell < editingStock.shares) {
                data.sharesToSell = sharesToSell;
            }
            onSave(data);
        } else {
            const { accountId, ...rest } = formData;
            const data = {
                ...rest,
                shares: Number(formData.shares),
                costBasis: Number(formData.costBasis),
            };
            if (needsAccountPicker) {
                data.accountId = Number(accountId);
            }
            onSave(data);
        }
    };

    const isValid = !needsAccountPicker || formData.accountId;

    const totalCost = (Number(formData.shares) || 0) * (Number(formData.costBasis) || 0);
    const sharesToSell = Number(formData.sharesToSell) || 0;
    const isPartialSell = isSelling && editingStock && sharesToSell < editingStock.shares;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="modal-enter bg-card rounded-lg border border-border shadow-sm w-full max-w-xl overflow-hidden my-8">
                <div className="p-5 border-b border-border flex justify-between items-center bg-muted/50">
                    <div className="flex items-center gap-2">
                        {isSelling
                            ? <TrendingDown className="w-5 h-5 text-rose-500" />
                            : <TrendingUp className="w-5 h-5 text-emerald-500" />
                        }
                        <h2 className="text-lg font-bold text-foreground">
                            {isSelling ? `Sell ${editingStock?.ticker}` : editingStock ? 'Edit Stock' : 'Buy Stock'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {isSelling ? (
                        <>
                            {/* Selling context */}
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-rose-600 dark:text-rose-400 text-xs uppercase font-semibold">Ticker</span>
                                        <p className="font-bold text-rose-600 dark:text-rose-400">{editingStock?.ticker}</p>
                                    </div>
                                    <div>
                                        <span className="text-rose-600 dark:text-rose-400 text-xs uppercase font-semibold">Available</span>
                                        <p className="font-bold text-rose-600 dark:text-rose-400">{editingStock?.shares} shares</p>
                                    </div>
                                    <div>
                                        <span className="text-rose-600 dark:text-rose-400 text-xs uppercase font-semibold">Cost Basis</span>
                                        <p className="font-bold text-rose-600 dark:text-rose-400">${editingStock?.costBasis}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Shares to Sell *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={editingStock?.shares || 1}
                                        step="1"
                                        value={formData.sharesToSell || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sharesToSell: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-red-500 bg-card dark:bg-secondary text-foreground"
                                        required
                                    />
                                    {isPartialSell && (
                                        <p className="text-[10px] text-foreground mt-1">
                                            {editingStock.shares - sharesToSell} shares will remain
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Sale Date *</label>
                                    <input
                                        type="date"
                                        value={formData.soldDate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, soldDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-red-500 bg-card dark:bg-secondary text-foreground"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase mb-1">Sale Price *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.salePrice || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, salePrice: e.target.value }))}
                                            className="w-full pl-7 pr-3 py-2 border border-rose-500/30 dark:border-rose-500/30 rounded-lg focus:ring-rose-500 bg-card dark:bg-secondary text-foreground"
                                            placeholder="Per share"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            {formData.salePrice && editingStock && sharesToSell > 0 && (
                                <div className="bg-muted dark:bg-muted/50 p-3 rounded-lg border border-border dark:border-border text-right">
                                    <span className="text-xs text-muted-foreground uppercase mr-2">P/L:</span>
                                    <span className={`font-mono font-bold ${(Number(formData.salePrice) - editingStock.costBasis) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ${((Number(formData.salePrice) - editingStock.costBasis) * sharesToSell).toFixed(2)}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        ({sharesToSell} shares x ${(Number(formData.salePrice) - editingStock.costBasis).toFixed(2)})
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Buy / Edit form */}
                            {needsAccountPicker && (
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account *</label>
                                    <select
                                        value={formData.accountId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-card dark:bg-secondary text-foreground"
                                        required
                                    >
                                        <option value="">Select account...</option>
                                        {(accounts || []).map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ticker *</label>
                                <input
                                    type="text"
                                    value={formData.ticker || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. AAPL"
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring uppercase bg-card dark:bg-secondary text-foreground"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Shares *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={formData.shares || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, shares: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-card dark:bg-secondary text-foreground"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Cost Basis ($) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.costBasis || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, costBasis: e.target.value }))}
                                            className="w-full pl-7 pr-3 py-2 border border-emerald-500/30 dark:border-emerald-700 rounded-lg focus:ring-emerald-500 bg-card dark:bg-secondary text-foreground"
                                            placeholder="Per share"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Acquired Date *</label>
                                    <input
                                        type="date"
                                        value={formData.acquiredDate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, acquiredDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring bg-card dark:bg-secondary text-foreground"
                                        required
                                    />
                                </div>
                            </div>

                            {totalCost > 0 && (
                                <div className="bg-muted dark:bg-muted/50 p-3 rounded-lg border border-border dark:border-border text-right">
                                    <span className="text-xs text-muted-foreground uppercase mr-2">Total Cost:</span>
                                    <span className="font-mono font-bold text-foreground">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={2}
                                    placeholder="Optional notes about this purchase..."
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card dark:bg-secondary text-foreground resize-none"
                                />
                            </div>
                        </>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground font-medium hover:bg-accent dark:hover:bg-accent"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:bg-secondary dark:disabled:bg-slate-600 ${
                                isSelling
                                    ? 'bg-destructive hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90'
                                    : 'bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90'
                            }`}
                        >
                            {isSelling
                                ? (isPartialSell ? `Sell ${sharesToSell} Shares` : 'Sell All Shares')
                                : editingStock ? 'Update Stock' : 'Buy Stock'
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
