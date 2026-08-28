import React from 'react';
import { Activity, Download, Upload, Plus, Settings, TrendingUp } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const Header = ({
    onExport,
    onImport,
    onNewTrade,
    onOpenSettings,
    version,
    accounts,
    selectedAccountId,
    onAccountChange,
    newTradeLabel,
    newTradeIcon: NewTradeIcon
}) => {
    return (
        <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-foreground flex flex-wrap items-center gap-2">
                        <Activity className="w-6 h-6 text-foreground shrink-0" />
                        Optionable
                        {version && (
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                v{version}
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Documenting the Wheel Strategy</p>
                </div>

                {/* Account Selector — own row on narrow screens */}
                {accounts && accounts.length > 0 && (
                    <Select
                        value={selectedAccountId == null ? 'all' : String(selectedAccountId)}
                        onValueChange={(v) => onAccountChange(v === 'all' ? null : Number(v))}
                    >
                        <SelectTrigger className="w-full sm:w-52 bg-muted border-border">
                            <SelectValue placeholder="All Accounts" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Accounts</SelectItem>
                            {accounts.map(account => (
                                <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Button variant="secondary" onClick={onOpenSettings} title="Settings">
                    <Settings />
                    <span className="hidden sm:inline">Settings</span>
                </Button>
                <Button variant="secondary" onClick={onExport} title="Export to CSV">
                    <Download />
                    <span className="hidden sm:inline">Export</span>
                </Button>
                <label className={cn(buttonVariants({ variant: 'secondary' }), 'cursor-pointer')} title="Import from CSV">
                    <Upload />
                    <span className="hidden sm:inline">Import</span>
                    <input type="file" accept=".csv" onChange={onImport} className="hidden" />
                </label>
                <Button onClick={onNewTrade}>
                    {NewTradeIcon ? <NewTradeIcon /> : <Plus />}
                    {newTradeLabel || 'New Trade'}
                </Button>
            </div>
        </Card>
    );
};
