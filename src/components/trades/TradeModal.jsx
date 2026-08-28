import React, { useState } from 'react';
import { RefreshCw, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { isBuySide } from '../../utils/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TRADE_TYPE_INFO = {
    CSP: { label: 'CSP (Sell Put)', description: 'Cash Secured Put — Sell a put, collect premium. Obligated to buy shares at strike if assigned.' },
    CC: { label: 'CC (Sell Call)', description: 'Covered Call — Sell a call on shares you own, collect premium. Obligated to sell at strike if assigned.' },
    CALL: { label: 'Call (Buy)', description: 'Long Call — Pay premium for the right to buy shares at strike. Profit when stock rises above strike + premium.' },
    PUT: { label: 'Put (Buy)', description: 'Long Put — Pay premium for the right to sell shares at strike. Profit when stock falls below strike - premium.' },
};

export const TradeModal = ({
    isModalOpen,
    formData,
    setFormData,
    editingId,
    isRolling,
    rollFromTrade,
    rollClosePrice,
    setRollClosePrice,
    handleInputChange,
    closeModal,
    saveTrade,
    accounts,
    selectedAccountId,
    modalAccountId,
    setModalAccountId
}) => {
    const [showTypeHelp, setShowTypeHelp] = useState(false);

    if (!isModalOpen) return null;

    const needsAccountPicker = !selectedAccountId && !editingId && !isRolling;
    const isBuy = isBuySide(formData.type);

    return (
        <Dialog open onOpenChange={(open) => { if (!open) closeModal(); }}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {editingId ? 'Edit Trade' : isRolling ? 'Roll Trade' : 'New Trade'}
                    </DialogTitle>
                    {isRolling && rollFromTrade && (
                        <DialogDescription className="flex items-center gap-1 text-foreground">
                            <RefreshCw className="w-3 h-3" />
                            Rolling {rollFromTrade.ticker} ${rollFromTrade.strike} {rollFromTrade.type}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <form onSubmit={saveTrade} className="space-y-4">

                    {/* Account Picker (only when creating new trade with no account selected) */}
                    {needsAccountPicker && (
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account *</label>
                            <Select
                                value={modalAccountId ? String(modalAccountId) : undefined}
                                onValueChange={(v) => setModalAccountId(Number(v))}
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

                    {/* Original Trade Close Section (only when rolling) */}
                    {isRolling && rollFromTrade && (
                        <div className="bg-muted border border-border rounded-lg p-4 space-y-3">
                            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Close Original Position
                            </h3>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground text-xs">Ticker</span>
                                    <p className="font-bold text-foreground">{rollFromTrade.ticker}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Strike</span>
                                    <p className="font-bold text-foreground">${rollFromTrade.strike}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-xs">Entry Premium</span>
                                    <p className="font-bold text-emerald-600 dark:text-emerald-400">${rollFromTrade.entryPrice}</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                                    Close Cost (per share) *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                    <Input
                                        type="number" step="0.01" required
                                        value={rollClosePrice}
                                        onChange={(e) => setRollClosePrice(e.target.value)}
                                        className="pl-7"
                                        placeholder="Cost to buy back original"
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Original P/L: {formatCurrency(
                                        (rollFromTrade.type === 'CALL' || rollFromTrade.type === 'PUT'
                                            ? ((Number(rollClosePrice) || 0) - rollFromTrade.entryPrice)
                                            : (rollFromTrade.entryPrice - (Number(rollClosePrice) || 0))
                                        ) * rollFromTrade.quantity * 100
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* New Trade Section Header (only when rolling) */}
                    {isRolling && (
                        <div className="border-t border-border pt-4">
                            <h3 className="font-semibold text-foreground text-sm mb-3">New Rolled Position</h3>
                        </div>
                    )}

                    <div className="grid grid-cols-1">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ticker</label>
                            <Input
                                type="text" name="ticker" required
                                value={formData.ticker} onChange={handleInputChange}
                                className="uppercase"
                                placeholder="e.g. GOOG"
                                readOnly={isRolling}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Opened</label>
                            <Input type="date" name="openedDate" required value={formData.openedDate} onChange={handleInputChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Expiration *</label>
                            <Input type="date" name="expirationDate" required value={formData.expirationDate} onChange={handleInputChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Closed (Opt)</label>
                            <Input type="date" name="closedDate" value={formData.closedDate} onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                                Type
                                <button
                                    type="button"
                                    onClick={() => setShowTypeHelp(!showTypeHelp)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Info className="w-3 h-3" />
                                </button>
                            </label>
                            <Select
                                value={formData.type}
                                onValueChange={(v) => handleInputChange({ target: { name: 'type', value: v } })}
                                disabled={isRolling}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TRADE_TYPE_INFO).map(([key, info]) => (
                                        <SelectItem key={key} value={key}>{info.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Strike *</label>
                            <Input type="number" step="0.5" name="strike" required value={formData.strike} onChange={handleInputChange} placeholder="0.00" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Qty</label>
                            <Input type="number" name="quantity" required value={formData.quantity} onChange={handleInputChange} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Delta</label>
                            <Input type="number" step="0.01" min="0" max="1" name="delta" value={formData.delta} onChange={handleInputChange} placeholder="0.30" />
                        </div>
                    </div>

                    {/* Type help tooltip */}
                    {showTypeHelp && (
                        <div className="bg-muted border border-border rounded-lg p-3 space-y-2">
                            {Object.entries(TRADE_TYPE_INFO).map(([key, info]) => (
                                <div key={key} className="flex gap-2">
                                    <span className="text-xs font-bold min-w-[52px] text-foreground">{key}</span>
                                    <span className="text-xs text-muted-foreground">{info.description}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg border border-border">
                        <div>
                            <label className={`block text-xs font-semibold uppercase mb-1 ${
                                isBuy
                                    ? 'text-rose-500 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                                {isRolling ? 'New Premium *' : isBuy ? 'Premium Paid ($)' : 'Entry Premium ($)'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <Input
                                    type="number" step="0.01" name="entryPrice" required
                                    value={formData.entryPrice} onChange={handleInputChange}
                                    className={`pl-7 ${
                                        isBuy
                                            ? 'border-rose-500/30 dark:border-rose-400/30 focus-visible:ring-rose-500'
                                            : 'border-emerald-500/30 dark:border-emerald-400/30 focus-visible:ring-emerald-500'
                                    }`}
                                    placeholder="Price per share"
                                />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 text-right">
                                Total: {formatCurrency((formData.entryPrice || 0) * (formData.quantity || 0) * 100)}
                                {isBuy && <span className="ml-1">(debit)</span>}
                            </div>
                        </div>

                        {!isRolling && (
                            <div>
                                <label className={`block text-xs font-semibold uppercase mb-1 ${
                                    isBuy
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-500 dark:text-rose-400'
                                }`}>
                                    {isBuy ? 'Sell Price ($)' : 'Close Cost ($)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                    <Input
                                        type="number" step="0.01" name="closePrice"
                                        value={formData.closePrice} onChange={handleInputChange}
                                        className={`pl-7 ${
                                            isBuy
                                                ? 'border-emerald-500/30 dark:border-emerald-400/30 focus-visible:ring-emerald-500'
                                                : 'border-rose-500/30 dark:border-rose-400/30 focus-visible:ring-rose-500'
                                        }`}
                                        placeholder="0.00 if open"
                                    />
                                </div>
                            </div>
                        )}

                        {isRolling && (() => {
                            const isBuy = rollFromTrade && (rollFromTrade.type === 'CALL' || rollFromTrade.type === 'PUT');
                            const netPerShare = isBuy
                                ? (Number(rollClosePrice) || 0) - (Number(formData.entryPrice) || 0)
                                : (Number(formData.entryPrice) || 0) - (Number(rollClosePrice) || 0);
                            const netTotal = netPerShare * (formData.quantity || 1) * 100;
                            return (
                                <div className="flex flex-col justify-center">
                                    <div className="text-xs text-muted-foreground uppercase mb-1">Net Credit/Debit</div>
                                    <div className={`text-xl font-bold ${netPerShare >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                        {formatCurrency(netTotal)}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {netPerShare >= 0 ? 'Credit' : 'Debit'}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Commission */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Commission ($)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                            <Input
                                type="number" step="0.01" min="0" name="commission"
                                value={formData.commission} onChange={handleInputChange}
                                className="pl-7"
                                placeholder="Auto"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Leave blank to auto-calculate from account rate</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Notes</label>
                        <Textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            rows={2}
                            className="resize-none"
                            placeholder="Optional notes about this trade..."
                        />
                    </div>

                    {!isRolling && (
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Status</label>
                            <div className="grid grid-cols-4 gap-2">
                                {['Open', 'Expired', 'Assigned', 'Closed'].map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: s }))}
                                        className={cn(
                                            'py-2 text-xs font-medium rounded-md border transition-colors',
                                            formData.status === s
                                                ? 'bg-foreground text-background border-foreground'
                                                : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-foreground'
                                        )}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">Use the Roll button to roll a trade</p>
                        </div>
                    )}

                    <div className="pt-2 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
                        <Button type="submit" className="flex-1" disabled={needsAccountPicker && !modalAccountId}>
                            {editingId ? 'Update Trade' : isRolling ? 'Roll & Create New' : 'Save Trade'}
                        </Button>
                    </div>

                </form>
            </DialogContent>
        </Dialog>
    );
};
