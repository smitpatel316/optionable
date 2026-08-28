import React, { useState, useEffect } from 'react';
import { TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { pnlTone } from '@/lib/pnl';
import { cn } from '@/lib/utils';

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

    if (!position) return null;

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
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                        Sell {position.ticker}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Position context */}
                    <div className="bg-muted border border-border rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                                <span className="text-muted-foreground text-xs uppercase font-semibold">Ticker</span>
                                <p className="font-bold text-foreground">{position.ticker}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase font-semibold">Available</span>
                                <p className="font-bold text-foreground">{position.shares} shares</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs uppercase font-semibold">Cost Basis</span>
                                <p className="font-bold text-foreground">${position.costBasis}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Shares to Sell *</label>
                            <Input
                                type="number"
                                min="1"
                                max={position.shares}
                                step="1"
                                value={formData.sharesToSell || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, sharesToSell: e.target.value }))}
                                required
                            />
                            {isPartialSell && sharesToSell > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {position.shares - sharesToSell} shares will remain
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

                    {/* P/L preview */}
                    {formData.salePrice && sharesToSell > 0 && (
                        <div className="bg-muted p-3 rounded-lg border border-border text-right">
                            <span className="text-xs text-muted-foreground uppercase mr-2">P/L:</span>
                            <span className={cn('font-mono font-bold', pnlTone(Number(formData.salePrice) - position.costBasis))}>
                                ${((Number(formData.salePrice) - position.costBasis) * sharesToSell).toFixed(2)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                                ({sharesToSell} shares x ${(Number(formData.salePrice) - position.costBasis).toFixed(2)})
                            </span>
                        </div>
                    )}

                    <div className="pt-2 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive" className="flex-1">
                            {isPartialSell && sharesToSell > 0 ? `Sell ${sharesToSell} Shares` : 'Sell All Shares'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
