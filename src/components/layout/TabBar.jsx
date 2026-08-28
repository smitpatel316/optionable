import React from 'react';
import { TrendingUp, Briefcase, Landmark, Activity } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const TabBar = ({ activeTab, onTabChange, showIncome = false }) => {
    const tabs = [
        { id: 'options', label: 'Options', icon: TrendingUp },
        { id: 'analytics', label: 'Analytics', icon: Activity },
        { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
        ...(showIncome ? [{ id: 'income', label: 'Income', icon: Landmark }] : []),
    ];

    return (
        <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="w-full bg-card border border-border h-auto p-1 gap-1">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <TabsTrigger key={tab.id} value={tab.id} className="flex-1 px-2 sm:px-4 py-2">
                            <Icon />
                            <span className="hidden xs:inline sm:inline">{tab.label}</span>
                        </TabsTrigger>
                    );
                })}
            </TabsList>
        </Tabs>
    );
};
