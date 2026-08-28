import React, { useState, useEffect } from 'react';
import { Keyboard, TrendingUp, RefreshCw, PlusCircle, FileText, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'optionable_welcome_dismissed';

export const WelcomeModal = ({ isOpen: externalOpen, onClose }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    // Show on first visit if not dismissed
    useEffect(() => {
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
            setInternalOpen(true);
        }
    }, []);

    // Modal is open if either internal (first visit) or external (H key) triggers it
    const isOpen = internalOpen || externalOpen;

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem(STORAGE_KEY, 'true');
        }
        setInternalOpen(false);
        if (onClose) onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
                <DialogHeader className="p-5 border-b border-border space-y-1">
                    <DialogTitle className="text-xl">Welcome to Optionable</DialogTitle>
                    <DialogDescription>Your wheel strategy tracker</DialogDescription>
                </DialogHeader>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* How It Works */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            How the Wheel Works
                        </h3>
                        <div className="space-y-2">
                            <Step number="1" title="Sell a Cash-Secured Put (CSP)" description="Collect premium on a stock you'd like to own at a lower price" />
                            <StepArrow />
                            <Step number="2" title="If assigned, you get the shares" description="Your position shows up automatically in the Stock Positions table" />
                            <StepArrow />
                            <Step number="3" title="Sell Covered Calls (CC) on those shares" description="Use the CC button on your position to start collecting more premium" />
                            <StepArrow />
                            <Step number="4" title="Repeat until shares are called away" description="Roll trades forward or let them expire — all linked in a chain" />
                        </div>
                    </div>

                    {/* Features */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Key Features
                        </h3>
                        <div className="space-y-3">
                            <Feature
                                icon={<PlusCircle className="w-4 h-4" />}
                                title="Track CSP & CC Trades"
                                description="Log trades with strike, premium, delta, and expiration. See P/L instantly."
                            />
                            <Feature
                                icon={<RefreshCw className="w-4 h-4" />}
                                title="Roll & Chain Trades"
                                description="Roll options forward — trades are linked together so you can track the full chain P/L."
                            />
                            <Feature
                                icon={<TrendingUp className="w-4 h-4" />}
                                title="Stock Positions & Live Prices"
                                description="Assigned CSPs auto-create stock positions. Enable live prices in Settings."
                            />
                            <Feature
                                icon={<FileText className="w-4 h-4" />}
                                title="Import & Export"
                                description="Back up everything to CSV. Supports trades, fund transactions, and stock purchases."
                            />
                        </div>
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Keyboard className="w-4 h-4" />
                            Keyboard Shortcuts
                        </h3>
                        <div className="bg-muted rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <Shortcut keys={['N']} action="New trade" />
                                <Shortcut keys={['S']} action="Settings" />
                                <Shortcut keys={['H']} action="Help" />
                                <Shortcut keys={['Esc']} action="Close modal" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="text-sm text-muted-foreground bg-muted border border-border rounded-lg p-3">
                        <p className="font-medium text-foreground mb-1">Quick Tip</p>
                        <p>When a CSP is assigned, click the <span className="font-medium text-foreground">Sell CC</span> button on that trade to quickly open a covered call on those shares. Enable <span className="font-medium text-foreground">Portfolio Mode</span> in Settings to track deposits, withdrawals, and manual stock purchases.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/50 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-input accent-zinc-900 dark:accent-zinc-100"
                        />
                        Don't show this again
                    </label>
                    <Button onClick={handleClose}>
                        Get Started
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const Step = ({ number, title, description }) => (
    <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            {number}
        </div>
        <div>
            <p className="font-medium text-foreground text-sm">{title}</p>
            <p className="text-muted-foreground text-xs">{description}</p>
        </div>
    </div>
);

const StepArrow = () => (
    <div className="flex justify-center pl-3">
        <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
    </div>
);

const Feature = ({ icon, title, description }) => (
    <div className="flex items-start gap-3">
        <div className="p-2 bg-muted text-foreground rounded-lg">
            {icon}
        </div>
        <div>
            <p className="font-medium text-foreground text-sm">{title}</p>
            <p className="text-muted-foreground text-xs">{description}</p>
        </div>
    </div>
);

const Shortcut = ({ keys, action }) => (
    <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{action}</span>
        <div className="flex gap-1">
            {keys.map((key, i) => (
                <kbd
                    key={i}
                    className="px-2 py-0.5 bg-background border border-border rounded text-xs font-mono text-foreground shadow-sm"
                >
                    {key}
                </kbd>
            ))}
        </div>
    </div>
);
