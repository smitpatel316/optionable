import React, { useState, useEffect } from 'react';
import { X, TrendingDown } from 'lucide-react';

export const PositionSellModal = ({ isOpen, onClose, onSave, position }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (isOpen && position) {
            setFormData({
                sharesToSell: position.shares,
                soldDate: new Date().toISOString().split('T')[0],
                salePrice: '',
            });
        }
    }, [position, isOpen]);

    if (!isOpen || !position) return null;

    const sharesToSell = Number(formData.sharesToSell) || 0;
    const isPartialSell = sharesToSell < position.shares;

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = {
            soldDate: formData.soldDate,
            salePrice: Number(formData.salePrice),
        };
        if (sharesToSell < position.shares) {
            data.sharesToSell = sharesToSell;
        }
        onSave(data);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <div className="modal-enter bg-card rounded-lg border border-border shadow-sm w-full max-w-xl overflow-hidden my-8">
                <div className="p-5 border-b border-border flex justify-between items-center bg-muted/50">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                        <h2 className="text-lg font-bold text-foreground">
                            Sell {position.ticker}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Position context */}
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                                <span className="text-rose-600 dark:text-rose-400 text-xs uppercase font-semibold">Ticker</span>
                                <p className="font-bold text-rose-600 dark:text-rose-400">{position.ticker}</p>
                            </div>
                            <div>
                                <span className="text-rose-600 dark:text-rose-400 text-xs uppercase font-semibold">Available</span>
                                <p className="font-bold text-rose-600 dark:text-rose-400">{position.shares} shares</p>
                            </div>
                            <div>
                                <span className="text-rose-600 dark:text-rose-400 text-xs uppercase font-semibold">Cost Basis</span>
                                <p className="font-bold text-rose-600 dark:text-rose-400">${position.costBasis}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Shares to Sell *</label>
                            <input
                                type="number"
                                min="1"
                                max={position.shares}
                                step="1"
                                value={formData.sharesToSell || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, sharesToSell: e.target.value }))}
                                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-red-500 bg-card dark:bg-secondary text-foreground"
                                required
                            />
                            {isPartialSell && sharesToSell > 0 && (
                                <p className="text-[10px] text-foreground mt-1">
                                    {position.shares - sharesToSell} shares will remain
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

                    {/* P/L preview */}
                    {formData.salePrice && sharesToSell > 0 && (
                        <div className="bg-muted dark:bg-muted/50 p-3 rounded-lg border border-border dark:border-border text-right">
                            <span className="text-xs text-muted-foreground uppercase mr-2">P/L:</span>
                            <span className={`font-mono font-bold ${(Number(formData.salePrice) - position.costBasis) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                ${((Number(formData.salePrice) - position.costBasis) * sharesToSell).toFixed(2)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                                ({sharesToSell} shares x ${(Number(formData.salePrice) - position.costBasis).toFixed(2)})
                            </span>
                        </div>
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
                            className="flex-1 px-4 py-2 rounded-lg font-semibold text-white bg-destructive hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
                        >
                            {isPartialSell && sharesToSell > 0 ? `Sell ${sharesToSell} Shares` : 'Sell All Shares'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
