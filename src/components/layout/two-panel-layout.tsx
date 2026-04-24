'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { LEFT_PANEL_NARROW_THRESHOLD } from '@/lib/design-tokens';
import { ChevronLeft } from 'lucide-react';

interface NarrowModeContextType {
    isNarrow: boolean;
}
const NarrowModeContext = React.createContext<NarrowModeContextType>({ isNarrow: false });

export function useNarrowMode() {
    return React.useContext(NarrowModeContext);
}

interface MobileBackContextType {
    onBack?: () => void;
}
const MobileBackContext = React.createContext<MobileBackContextType>({});

export function useMobileBack() {
    return React.useContext(MobileBackContext);
}

interface TwoPanelLayoutProps {
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    isRightPanelOpen: boolean;
    onBack?: () => void;
    /** @deprecated kept for API compatibility; layout is now driven by Tailwind responsive classes. */
    leftPanelDefaultSize?: number;
    /** @deprecated kept for API compatibility; layout is now driven by Tailwind responsive classes. */
    rightPanelDefaultSize?: number;
    /** @deprecated kept for API compatibility; layout is now driven by Tailwind responsive classes. */
    minLeftSize?: number;
    /** @deprecated kept for API compatibility; layout is now driven by Tailwind responsive classes. */
    minRightSize?: number;
    className?: string;
    /** When true, renders only the right panel at full width. */
    forceRightOnly?: boolean;
}

export function TwoPanelLayout({
    leftPanel,
    rightPanel,
    isRightPanelOpen,
    onBack,
    className,
    forceRightOnly = false,
}: TwoPanelLayoutProps) {
    const leftPanelRef = React.useRef<HTMLDivElement>(null);
    const leftPanelWidth = usePanelWidth(leftPanelRef);
    const isNarrow = isRightPanelOpen && leftPanelWidth > 0 && leftPanelWidth < LEFT_PANEL_NARROW_THRESHOLD;

    if (forceRightOnly && isRightPanelOpen) {
        return (
            <NarrowModeContext.Provider value={{ isNarrow: false }}>
                <div className={cn("flex-1 w-full overflow-hidden min-h-0", className)}>
                    {rightPanel}
                </div>
            </NarrowModeContext.Provider>
        );
    }

    return (
        <MobileBackContext.Provider value={{ onBack }}>
            <div className={cn("grid grid-cols-1 lg:grid-cols-5 h-full min-h-0 overflow-hidden", className)}>
                <div
                    ref={leftPanelRef}
                    className={cn(
                        "h-full min-h-0 overflow-hidden px-1",
                        isRightPanelOpen ? "hidden lg:block lg:col-span-2" : "lg:col-span-5"
                    )}
                >
                    <NarrowModeContext.Provider value={{ isNarrow }}>
                        {leftPanel}
                    </NarrowModeContext.Provider>
                </div>
                {isRightPanelOpen && (
                    <div className="lg:col-span-3 h-full min-h-0 overflow-hidden flex flex-col px-1">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-background border-b border-border flex-none"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Atrás
                            </button>
                        )}
                        <div className="flex-1 min-h-0 overflow-hidden">
                            {rightPanel}
                        </div>
                    </div>
                )}
            </div>
        </MobileBackContext.Provider>
    );
}
