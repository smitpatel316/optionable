import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { FundTransactionModal } from './FundTransactionModal';

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const num = Number(value);
    const sign = num >= 0 ? '' : '-';
    return `${sign}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const typeColors = {
    deposit: 'bg-success/15 text-emerald-700 dark:bg-success/15 dark:text-emerald-400',
    withdrawal: 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    dividend: 'bg-muted text-foreground dark:bg-muted dark:text-foreground',
    interest: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    fee: 'bg-muted text-foreground dark:bg-secondary dark:text-foreground',
};

export const FundJournal = ({ transactions, onCreate, onUpdate, onDelete, showToast, selectedAccountId, accounts, itemsPerPage }) => {
    const [showModal, setShowModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Reset to page 1 when items per page changes
    useEffect(() => { setCurrentPage(1); }, [itemsPerPage]);

    const handleSave = async (data) => {
        try {
            if (editingTransaction) {
                await onUpdate(editingTransaction.id, data);
                showToast?.('Transaction updated', 'success');
            } else {
                await onCreate(data);
                showToast?.('Transaction added', 'success');
            }
            setShowModal(false);
            setEditingTransaction(null);
        } catch (err) {
            showToast?.('Failed to save transaction', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this transaction?')) return;
        try {
            await onDelete(id);
            showToast?.('Transaction deleted', 'success');
        } catch (err) {
            showToast?.('Failed to delete transaction', 'error');
        }
    };

    const handleEdit = (txn) => {
        setEditingTransaction(txn);
        setShowModal(true);
    };

    // Pagination
    const showAll = itemsPerPage === null || itemsPerPage === undefined;
    const totalPages = showAll ? 1 : Math.ceil(transactions.length / itemsPerPage);
    const safePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedTransactions = showAll
        ? transactions
        : transactions.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

    return (
        <div className="bg-card rounded-lg shadow-sm border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Fund Journal</h3>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {transactions.length} transactions
                    </span>
                    <button
                        onClick={() => { setEditingTransaction(null); setShowModal(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
                        title="Add transaction"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>

            {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    No transactions yet. Add deposits, withdrawals, dividends, and other cash flows.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted">
                                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase">Date</th>
                                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase">Type</th>
                                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-semibold uppercase">Amount</th>
                                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase">Description</th>
                                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-semibold uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedTransactions.map(txn => (
                                <tr key={txn.id} className="hover:bg-accent dark:hover:bg-accent/30 transition-colors">
                                    <td className="px-5 py-3 text-foreground">{txn.date}</td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${typeColors[txn.type] || ''}`}>
                                            {txn.type}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-foreground">
                                        {formatCurrency(txn.amount)}
                                    </td>
                                    <td className="px-5 py-3 text-muted-foreground max-w-[250px] truncate">
                                        {txn.description || '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleEdit(txn)}
                                                className="p-1.5 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground hover:bg-accent dark:hover:bg-accent rounded transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(txn.id)}
                                                className="p-1.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between bg-muted/50">
                    <div className="text-sm text-muted-foreground">
                        Showing {((safePage - 1) * itemsPerPage) + 1} – {Math.min(safePage * itemsPerPage, transactions.length)} of {transactions.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-accent dark:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium ${page === safePage
                                        ? 'bg-primary dark:bg-primary text-white'
                                        : 'text-muted-foreground hover:bg-accent dark:hover:bg-accent'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-accent dark:hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <FundTransactionModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingTransaction(null); }}
                onSave={handleSave}
                editingTransaction={editingTransaction}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
            />
        </div>
    );
};
