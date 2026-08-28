import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { FundTransactionModal } from './FundTransactionModal';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    const num = Number(value);
    const sign = num >= 0 ? '' : '-';
    return `${sign}$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Cash-flow direction carries the hue (money in vs out); neutral types are zinc.
const typeVariants = {
    deposit: 'success',
    withdrawal: 'destructive',
    dividend: 'secondary',
    interest: 'secondary',
    fee: 'muted',
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
        <Card className="overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Fund Journal</h3>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {transactions.length} transactions
                    </span>
                    <Button
                        size="sm"
                        onClick={() => { setEditingTransaction(null); setShowModal(true); }}
                        title="Add transaction"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </Button>
                </div>
            </div>

            {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                    No transactions yet. Add deposits, withdrawals, dividends, and other cash flows.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table className="min-w-[520px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTransactions.map(txn => (
                                <TableRow key={txn.id}>
                                    <TableCell className="px-5 text-foreground">{txn.date}</TableCell>
                                    <TableCell className="px-5">
                                        <Badge variant={typeVariants[txn.type] || 'muted'} className="capitalize font-normal">
                                            {txn.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-5 text-right font-mono text-foreground">
                                        {formatCurrency(txn.amount)}
                                    </TableCell>
                                    <TableCell className="px-5 text-muted-foreground max-w-[250px] truncate">
                                        {txn.description || '—'}
                                    </TableCell>
                                    <TableCell className="px-5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleEdit(txn)}
                                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(txn.id)}
                                                className="p-1.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
                            className="p-2 rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                        'w-8 h-8 rounded-md text-sm font-medium transition-colors',
                                        page === safePage
                                            ? 'bg-foreground text-background'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="p-2 rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        </Card>
    );
};
