import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FUND_TRANSACTION_TYPES } from '../../utils/constants';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                        {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-accent dark:hover:bg-accent rounded-lg">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {needsAccountPicker && (
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Account *</label>
                            <select
                                value={formData.accountId}
                                onChange={(e) => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card dark:bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                        <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card dark:bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {FUND_TRANSACTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Amount ($)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card dark:bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card dark:bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Optional description"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card dark:bg-secondary text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 bg-muted hover:bg-accent dark:hover:bg-accent text-foreground rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            className="flex-1 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                        >
                            {editingTransaction ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
