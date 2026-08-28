import React, { useState, useEffect } from 'react';
import { Settings, Wifi, WifiOff, ShieldCheck, Briefcase, Sun, Moon, Plus, Pencil, Trash2, Check, HelpCircle, List, Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const WELCOME_STORAGE_KEY = 'optionable_welcome_dismissed';

const API_URL = import.meta.env.VITE_API_URL || '';

// One settings row: icon + label/description + switch.
const ToggleRow = ({ icon: Icon, title, description, checked, onToggle, disabled, children }) => (
    <div className="bg-muted rounded-lg">
        <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-foreground" />
                <div>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
        </div>
        {children}
    </div>
);

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

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
                <DialogHeader className="p-4 border-b border-border shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-foreground" />
                        Settings
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="p-12">
                        <div className="animate-spin w-8 h-8 border-2 border-foreground border-t-transparent rounded-full mx-auto"></div>
                    </div>
                ) : (
                <>
                {/* Settings List */}
                <div className="p-4 space-y-4 overflow-y-auto min-h-0">
                    {/* Confirm Expire Toggle */}
                    <ToggleRow
                        icon={ShieldCheck}
                        title="Confirm Expiry"
                        description="Ask for confirmation before expiring trades"
                        checked={confirmExpireEnabled}
                        onToggle={() => updateSetting('confirm_expire_enabled', confirmExpireEnabled ? 'false' : 'true')}
                        disabled={saving}
                    />

                    {/* Live Stock Prices Toggle */}
                    <ToggleRow
                        icon={livePricesEnabled ? Wifi : WifiOff}
                        title="Live Stock Prices"
                        description="Fetch prices from Yahoo Finance"
                        checked={livePricesEnabled}
                        onToggle={() => updateSetting('live_prices_enabled', livePricesEnabled ? 'false' : 'true')}
                        disabled={saving}
                    />

                    {/* Dark Mode Toggle */}
                    <ToggleRow
                        icon={darkMode ? Moon : Sun}
                        title="Dark Mode"
                        description={darkMode ? 'Dark theme active' : 'Light theme active'}
                        checked={darkMode}
                        onToggle={onToggleTheme}
                    />

                    {/* Paginate Trades Toggle */}
                    <ToggleRow
                        icon={List}
                        title="Enable Pagination"
                        description="Split tables into pages"
                        checked={paginationEnabled}
                        onToggle={() => updateSetting('pagination_enabled', paginationEnabled ? 'false' : 'true')}
                        disabled={saving}
                    >
                        {paginationEnabled && (
                            <div className="px-4 pb-4 pt-0">
                                <div className="flex items-center gap-3 pl-8">
                                    <label className="text-sm text-muted-foreground whitespace-nowrap">Items per page</label>
                                    <Input
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
                                        className="w-20 h-8 px-2 py-1"
                                    />
                                </div>
                            </div>
                        )}
                    </ToggleRow>

                    {/* Portfolio Mode Toggle */}
                    <ToggleRow
                        icon={Briefcase}
                        title="Portfolio Mode"
                        description="Track cash flow, stocks, and portfolio"
                        checked={portfolioModeEnabled}
                        onToggle={() => updateSetting('portfolio_mode_enabled', portfolioModeEnabled ? 'false' : 'true')}
                        disabled={saving}
                    />

                    {/* Show Help on Startup Toggle */}
                    <ToggleRow
                        icon={HelpCircle}
                        title="Show Help on Startup"
                        description="Display welcome guide when the app opens"
                        checked={showHelpOnStartup}
                        onToggle={toggleHelpOnStartup}
                    />

                    <hr className="border-border" />

                    {/* Export Database */}
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-foreground" />
                            <div>
                                <p className="font-medium text-foreground">Export Database</p>
                                <p className="text-sm text-muted-foreground">
                                    Download a backup of your data
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => {
                                const a = document.createElement('a');
                                a.href = `${API_URL}/api/settings/export-db`;
                                a.download = '';
                                a.click();
                            }}
                        >
                            Export
                        </Button>
                    </div>

                    <hr className="border-border" />

                    {/* Accounts Management */}
                    <div className="bg-muted rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-border">
                            <p className="font-semibold text-sm text-foreground text-center uppercase tracking-wide">Accounts</p>
                        </div>
                        <div className="p-4 space-y-2">
                            {accounts && accounts.map(account => (
                                <div key={account.id} className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border">
                                    {editingAccountId === account.id ? (
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="text"
                                                    value={editingAccountName}
                                                    onChange={(e) => setEditingAccountName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameAccount(account.id)}
                                                    className="flex-1 h-8 px-2 py-1"
                                                    placeholder="Account name"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleRenameAccount(account.id)}
                                                    className="p-1 text-foreground hover:bg-accent rounded"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setEditingAccountId(null); setEditingAccountName(''); setEditingAccountCommission(''); }}
                                                    className="p-1 text-muted-foreground hover:bg-accent rounded"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">$/contract</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={editingAccountCommission}
                                                    onChange={(e) => setEditingAccountCommission(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameAccount(account.id)}
                                                    className="w-24 h-8 px-2 py-1"
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
                                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAccount(account.id)}
                                                className="p-1.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
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
                                    <Input
                                        type="text"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                                        placeholder="New account name"
                                        className="flex-1"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleAddAccount}
                                        disabled={!newAccountName.trim()}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">Commission $/contract</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newAccountCommission}
                                        onChange={(e) => setNewAccountCommission(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                                        placeholder="e.g. 0.66"
                                        className="w-24 h-8 px-2 py-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border shrink-0">
                    <Button onClick={onClose} className="w-full">
                        Done
                    </Button>
                </div>
                </>
                )}
            </DialogContent>
        </Dialog>
    );
};
