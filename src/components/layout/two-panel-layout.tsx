'use client';

import * as React from 'react';
import {
    Group,
    Panel,
    Separator,
} from 'react-resizable-panels';
import { cn } from '@/lib/utils';

interface TwoPanelLayoutProps {
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    isRightPanelOpen: boolean;
    leftPanelDefaultSize?: number;
    rightPanelDefaultSize?: number;
    minLeftSize?: number;
    minRightSize?: number;
    className?: string;
}

export function TwoPanelLayout({
    leftPanel,
    rightPanel,
    isRightPanelOpen,
    leftPanelDefaultSize = 40,
    rightPanelDefaultSize = 60,
    minLeftSize = 20,
    minRightSize = 20,
    className,
}: TwoPanelLayoutProps) {
    const [mounted, setMounted] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!mounted) {
        return (
            <div className={cn("grid grid-cols-1 lg:grid-cols-5 h-full", className)}>
                <div className={cn("h-full min-h-0 overflow-hidden", isRightPanelOpen ? "hidden lg:block lg:col-span-2" : "lg:col-span-5")}>
                    {leftPanel}
                </div>
                {isRightPanelOpen && (
                    <div className="lg:col-span-3 h-full min-h-0 overflow-hidden">
                        {rightPanel}
                    </div>
                )}
            </div>
        );
    }

    if (isMobile) {
        return (
            <div className={cn("flex-1 w-full overflow-hidden flex flex-col min-h-0", className)}>
                {!isRightPanelOpen ? (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {leftPanel}
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {rightPanel}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cn("flex-1 w-full overflow-hidden flex flex-col min-h-0", className)}>
            <Group orientation="horizontal" className="flex-1">
                <Panel
                    defaultSize={isRightPanelOpen ? `${leftPanelDefaultSize}%` : "100%"}
                    minSize={isRightPanelOpen ? `${minLeftSize}%` : "100%"}
                    collapsible={false}
                    className="h-full relative overflow-hidden"
                    id="left-panel-v4"
                >
                    <div className="absolute inset-0 overflow-hidden px-1">
                        {leftPanel}
                    </div>
                </Panel>

                {isRightPanelOpen && (
                    <Separator className="w-2 hover:bg-primary/5 transition-colors flex items-center justify-center group relative cursor-col-resize z-10 outline-none">
                        <div className="h-4 w-1 rounded-full bg-border group-hover:bg-primary/20 transition-colors" />
                    </Separator>
                )}

                {isRightPanelOpen && (
                    <Panel
                        defaultSize={`${rightPanelDefaultSize}%`}
                        minSize={`${minRightSize}%`}
                        collapsible={false}
                        className="h-full relative overflow-hidden"
                        id="right-panel-v4"
                    >
                        <div className="absolute inset-0 overflow-hidden px-1">
                            {rightPanel}
                        </div>
                    </Panel>
                )}
            </Group>
        </div>
    );
}

