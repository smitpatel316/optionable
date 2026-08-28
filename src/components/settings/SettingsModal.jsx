import React, { useState, useEffect } from 'react';
import { Settings, X, Wifi, WifiOff, ShieldCheck, Briefcase, Sun, Moon, Plus, Pencil, Trash2, Check, HelpCircle, List, Download } from 'lucide-react';

const WELCOME_STORAGE_KEY = 'optionable_welcome_dismissed';

const API_URL = import.meta.env.VITE_API_URL || '';

export const SettingsModal = ({ onClose, showToast, accounts, onCreateAccount, onRenameAccount, onDeleteAccount, onAccountsChanged, darkMode, onToggleTheme }) => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [editingAccountId, setEditingAccountId] = useState(null);
    const [editingAccountName, setEditingAccountName] = useState('');
    const [newAccountCommission, setNewAccountCommission] = useState('');
    const [editingAccountCommission, setEditingAccountCommission] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_URL}/api/settings`);
            const data = await res.json();
            if (data.success) {
                setSettings(data.data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            showToast?.('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key, value) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/settings/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
            const data = await res.json();
            if (data.success) {
                setSettings(prev => ({ ...prev, [key]: value }));
                showToast?.('Setting updated', 'success');
            }
        } catch (error) {
            console.error('Error updating setting:', error);
            showToast?.('Failed to update setting', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddAccount = async () => {
        if (!newAccountName.trim()) return;
        try {
            const commission = newAccountCommission ? Number(newAccountCommission) : 0;
            await onCreateAccount(newAccountName.trim(), commission);
            setNewAccountName('');
            setNewAccountCommission('');
            showToast?.('Account created', 'success');
        } catch (err) {
            showToast?.('Failed to create account', 'error');
        }
    };

    const handleRenameAccount = async (id) => {
        if (!editingAccountName.trim()) return;
        try {
            const commission = editingAccountCommission !== '' ? Number(editingAccountCommission) : undefined;
            await onRenameAccount(id, editingAccountName.trim(), commission);
            setEditingAccountId(null);
            setEditingAccountName('');
            setEditingAccountCommission('');
            showToast?.('Account updated', 'success');
        } catch (err) {
            showToast?.('Failed to update account', 'error');
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account? This will only work if the account has no data.')) return;
        try {
            await onDeleteAccount(id);
            showToast?.('Account deleted', 'success');
        } catch (err) {
            const msg = err.message || 'Cannot delete account with existing data';
            showToast?.(msg, 'error');
        }
    };

    const [showHelpOnStartup, setShowHelpOnStartup] = useState(() => {
        return !localStorage.getItem(WELCOME_STORAGE_KEY);
    });

    const toggleHelpOnStartup = () => {
        if (showHelpOnStartup) {
            localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
            setShowHelpOnStartup(false);
        } else {
            localStorage.removeItem(WELCOME_STORAGE_KEY);
            setShowHelpOnStartup(true);
        }
    };

    const livePricesEnabled = settings.live_prices_enabled === 'true';
    const confirmExpireEnabled = settings.confirm_expire_enabled !== 'false'; // Default true
    const portfolioModeEnabled = settings.portfolio_mode_enabled === 'true';
    const paginationEnabled = settings.pagination_enabled !== 'false';
    const [tradesPerPageInput, setTradesPerPageInput] = useState(settings.trades_per_page || '5');

    useEffect(() => {
        setTradesPerPageInput(settings.trades_per_page || '5');
    }, [settings.trades_per_page]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-card rounded-lg p-8">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-foreground" />
                        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent dark:hover:bg-accent rounded-lg"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Settings List */}
                <div className="p-4 space-y-4 overflow-y-auto">
                    {/* Confirm Expire Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-foreground" />
                            <div>
                                <p className="font-medium text-foreground">Confirm Expiry</p>
                                <p className="text-sm text-muted-foreground">
                                    Ask for confirmation before expiring trades
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('confirm_expire_enabled', confirmExpireEnabled ? 'false' : 'true')}
                            disabled={saving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                confirmExpireEnabled
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full shadow transition-transform ${
                                    confirmExpireEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Live Stock Prices Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {livePricesEnabled ? (
                                <Wifi className="w-5 h-5 text-foreground" />
                            ) : (
                                <WifiOff className="w-5 h-5 text-foreground" />
                            )}
                            <div>
                                <p className="font-medium text-foreground">Live Stock Prices</p>
                                <p className="text-sm text-muted-foreground">
                                    Fetch prices from Yahoo Finance
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('live_prices_enabled', livePricesEnabled ? 'false' : 'true')}
                            disabled={saving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                livePricesEnabled
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full shadow transition-transform ${
                                    livePricesEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {darkMode ? (
                                <Moon className="w-5 h-5 text-foreground" />
                            ) : (
                                <Sun className="w-5 h-5 text-foreground" />
                            )}
                            <div>
                                <p className="font-medium text-foreground">Dark Mode</p>
                                <p className="text-sm text-muted-foreground">
                                    {darkMode ? 'Dark theme active' : 'Light theme active'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onToggleTheme}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                darkMode
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full shadow transition-transform ${
                                    darkMode ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Paginate Trades Toggle */}
                    <div className="bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                                <List className="w-5 h-5 text-foreground" />
                                <div>
                                    <p className="font-medium text-foreground">Enable Pagination</p>
                                    <p className="text-sm text-muted-foreground">
                                        Split tables into pages
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSetting('pagination_enabled', paginationEnabled ? 'false' : 'true')}
                                disabled={saving}
                                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                    paginationEnabled
                                        ? 'bg-primary'
                                        : 'bg-secondary'
                                }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full shadow transition-transform ${
                                        paginationEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                        {paginationEnabled && (
                            <div className="px-4 pb-4 pt-0">
                                <div className="flex items-center gap-3 pl-8">
                                    <label className="text-sm text-muted-foreground whitespace-nowrap">Items per page</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={tradesPerPageInput}
                                        onChange={(e) => setTradesPerPageInput(e.target.value)}
                                        onBlur={() => {
                                            const val = Math.max(1, Math.min(100, parseInt(tradesPerPageInput) || 5));
                                            setTradesPerPageInput(String(val));
                                            updateSetting('trades_per_page', String(val));
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                        className="w-20 px-2 py-1 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Portfolio Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Briefcase className="w-5 h-5 text-foreground" />
                            <div>
                                <p className="font-medium text-foreground">Portfolio Mode</p>
                                <p className="text-sm text-muted-foreground">
                                    Track cash flow, stocks, and portfolio
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('portfolio_mode_enabled', portfolioModeEnabled ? 'false' : 'true')}
                            disabled={saving}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                portfolioModeEnabled
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full shadow transition-transform ${
                                    portfolioModeEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Show Help on Startup Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <HelpCircle className="w-5 h-5 text-foreground" />
                            <div>
                                <p className="font-medium text-foreground">Show Help on Startup</p>
                                <p className="text-sm text-muted-foreground">
                                    Display welcome guide when the app opens
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleHelpOnStartup}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                showHelpOnStartup
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-card rounded-full shadow transition-transform ${
                                    showHelpOnStartup ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    <hr className="border-border" />

                    {/* Export Database */}
                    <div className="flex items-center justify-between p-4 bg-muted dark:bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-foreground" />
                            <div>
                                <p className="font-medium text-foreground">Export Database</p>
                                <p className="text-sm text-muted-foreground">
                                    Download a backup of your data
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const a = document.createElement('a');
                                a.href = `${API_URL}/api/settings/export-db`;
                                a.download = '';
                                a.click();
                            }}
                            className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
                        >
                            Export
                        </button>
                    </div>

                    <hr className="border-border" />

                    {/* Accounts Management */}
                    <div className="bg-muted dark:bg-muted/50 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-border">
                            <p className="font-semibold text-sm text-foreground text-center uppercase tracking-wide">Accounts</p>
                        </div>
                        <div className="p-4 space-y-2">
                            {accounts && accounts.map(account => (
                                <div key={account.id} className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
                                    {editingAccountId === account.id ? (
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingAccountName}
                                                    onChange={(e) => setEditingAccountName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameAccount(account.id)}
                                                    className="flex-1 px-2 py-1 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                    placeholder="Account name"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleRenameAccount(account.id)}
                                                    className="p-1 text-emerald-600 hover:bg-success/15 dark:hover:bg-emerald-900/30 rounded"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingAccountId(null); setEditingAccountName(''); setEditingAccountCommission(''); }}
                                                    className="p-1 text-muted-foreground hover:bg-accent dark:hover:bg-accent rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">$/contract</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={editingAccountCommission}
                                                    onChange={(e) => setEditingAccountCommission(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameAccount(account.id)}
                                                    className="w-24 px-2 py-1 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-foreground">{account.name}</span>
                                                {account.commissionPerContract > 0 && (
                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                        ${account.commissionPerContract}/contract
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => { setEditingAccountId(account.id); setEditingAccountName(account.name); setEditingAccountCommission(account.commissionPerContract || ''); }}
                                                className="p-1.5 text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-accent rounded transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAccount(account.id)}
                                                className="p-1.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="px-4 pb-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                                        placeholder="New account name"
                                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-card text-foreground placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                    <button
                                        onClick={handleAddAccount}
                                        disabled={!newAccountName.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 disabled:bg-secondary dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">Commission $/contract</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newAccountCommission}
                                        onChange={(e) => setNewAccountCommission(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                                        placeholder="e.g. 0.66"
                                        className="w-24 px-2 py-1 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
