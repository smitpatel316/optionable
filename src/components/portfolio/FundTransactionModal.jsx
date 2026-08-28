import React, { useState, useEffect } from 'react';
import { FUND_TRANSACTION_TYPES } from '../../utils/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const FundTransactionModal = ({ isOpen, onClose, onSave, editingTransaction, accounts, selectedAccountId }) => {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (editingTransaction) {
            setFormData({
                type: editingTransaction.type,
                amount: editingTransaction.amount,
                date: editingTransaction.date,
                description: editingTransaction.description || '',
            });
        } else {
            setFormData({
                type: 'deposit',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: '',
                accountId: '',
            });
        }
    }, [editingTransaction, isOpen]);

    if (!isOpen) return null;

    const needsAccountPicker = !selectedAccountId && !editingTransaction;

    const handleSubmit = (e) => {
        e.preventDefault();
        const { accountId, ...rest } = formData;
        const data = {
            ...rest,
            amount: Number(formData.amount),
        };
        if (needsAccountPicker) {
            data.accountId = Number(accountId);
        }
        onSave(data);
    };

    const isValid = !needsAccountPicker || formData.accountId;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                        <Select
                            value={formData.type}
                            onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {FUND_TRANSACTION_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Amount ($)</label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                        <Input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                        <Input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Optional description"
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!isValid} className="flex-1">
                            {editingTransaction ? 'Update' : 'Add'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
