import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

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
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isSelling
                            ? <TrendingDown className="w-5 h-5 text-foreground" />
                            : <TrendingUp className="w-5 h-5 text-foreground" />
                        }
                        {isSelling ? `Sell ${editingStock?.ticker}` : editingStock ? 'Edit Stock' : 'Buy Stock'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSelling ? (
                        <>
                            {/* Selling context */}
                            <div className="bg-muted border border-border rounded-lg p-4">
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <span className="text-muted-foreground text-xs uppercase font-semibold">Ticker</span>
                                        <p className="font-bold text-foreground">{editingStock?.ticker}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs uppercase font-semibold">Available</span>
                                        <p className="font-bold text-foreground">{editingStock?.shares} shares</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-xs uppercase font-semibold">Cost Basis</span>
                                        <p className="font-bold text-foreground">${editingStock?.costBasis}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Shares to Sell *</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max={editingStock?.shares || 1}
                                        step="1"
                                        value={formData.sharesToSell || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sharesToSell: e.target.value }))}
                                        required
                                    />
                                    {isPartialSell && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {editingStock.shares - sharesToSell} shares will remain
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Sale Date *</label>
                                    <Input
                                        type="date"
                                        value={formData.soldDate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, soldDate: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Sale Price *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.salePrice || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, salePrice: e.target.value }))}
                                            className="pl-7"
                                            placeholder="Per share"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            {formData.salePrice && editingStock && sharesToSell > 0 && (
                                <div className="bg-muted p-3 rounded-lg border border-border text-right">
                                    <span className="text-xs text-muted-foreground uppercase mr-2">P/L:</span>
                                    <span className={cn('font-mono font-bold', pnlTone(Number(formData.salePrice) - editingStock.costBasis))}>
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
                                    <Select
                                        value={formData.accountId || undefined}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select account..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(accounts || []).map(a => (
                                                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ticker *</label>
                                <Input
                                    type="text"
                                    value={formData.ticker || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                                    placeholder="e.g. AAPL"
                                    className="uppercase"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Shares *</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={formData.shares || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, shares: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Cost Basis ($) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.costBasis || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, costBasis: e.target.value }))}
                                            className="pl-7"
                                            placeholder="Per share"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Acquired Date *</label>
                                    <Input
                                        type="date"
                                        value={formData.acquiredDate || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, acquiredDate: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            {totalCost > 0 && (
                                <div className="bg-muted p-3 rounded-lg border border-border text-right">
                                    <span className="text-xs text-muted-foreground uppercase mr-2">Total Cost:</span>
                                    <span className="font-mono font-bold text-foreground">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notes</label>
                                <Textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={2}
                                    placeholder="Optional notes about this purchase..."
                                    className="resize-none"
                                />
                            </div>
                        </>
                    )}

                    <div className="pt-2 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isValid}
                            variant={isSelling ? 'destructive' : 'default'}
                            className="flex-1"
                        >
                            {isSelling
                                ? (isPartialSell ? `Sell ${sharesToSell} Shares` : 'Sell All Shares')
                                : editingStock ? 'Update Stock' : 'Buy Stock'
                            }
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
