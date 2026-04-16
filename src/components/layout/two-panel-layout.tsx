'use client';

import * as React from 'react';
import {
    Group,
    Panel,
    Separator,
} from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { usePanelWidth } from '@/hooks/use-panel-width';
import { LEFT_PANEL_NARROW_THRESHOLD } from '@/lib/design-tokens';
import { ChevronLeft } from 'lucide-react';

// Context so children of the left panel can react to narrow mode
interface NarrowModeContextType {
    isNarrow: boolean;
}
const NarrowModeContext = React.createContext<NarrowModeContextType>({ isNarrow: false });

export function useNarrowMode() {
    return React.useContext(NarrowModeContext);
}

// Context for mobile back button
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
    leftPanelDefaultSize?: number;
    rightPanelDefaultSize?: number;
    minLeftSize?: number;
    minRightSize?: number;
    className?: string;
    /** When true, renders only the right panel at full width (desktop expand mode) */
    forceRightOnly?: boolean;
}

export function TwoPanelLayout({
    leftPanel,
    rightPanel,
    isRightPanelOpen,
    onBack,
    leftPanelDefaultSize = 40,
    rightPanelDefaultSize = 60,
    minLeftSize = 20,
    minRightSize = 20,
    className,
    forceRightOnly = false,
}: TwoPanelLayoutProps) {
    const [mounted, setMounted] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const leftPanelRef = React.useRef<HTMLDivElement>(null);
    const leftPanelWidth = usePanelWidth(leftPanelRef);
    const isNarrow = isRightPanelOpen && leftPanelWidth > 0 && leftPanelWidth < LEFT_PANEL_NARROW_THRESHOLD;

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
                    <NarrowModeContext.Provider value={{ isNarrow: false }}>
                        {leftPanel}
                    </NarrowModeContext.Provider>
                </div>
                {isRightPanelOpen && (
                    <div className="lg:col-span-3 h-full min-h-0 overflow-hidden">
                        {rightPanel}
                    </div>
                )}
            </div>
        );
    }

    if (forceRightOnly && isRightPanelOpen) {
        return (
            <NarrowModeContext.Provider value={{ isNarrow: false }}>
                <div className={cn("flex-1 w-full overflow-hidden min-h-0", className)}>
                    {rightPanel}
                </div>
            </NarrowModeContext.Provider>
        );
    }

    if (isMobile) {
        return (
            <MobileBackContext.Provider value={{ onBack }}>
                <div className={cn("flex-1 w-full overflow-hidden flex flex-col min-h-0", className)}>
                    {!isRightPanelOpen ? (
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <NarrowModeContext.Provider value={{ isNarrow: false }}>
                                {leftPanel}
                            </NarrowModeContext.Provider>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                            {onBack && (
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-background border-b border-border flex-none"
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
                    <div ref={leftPanelRef} className="absolute inset-0 overflow-hidden px-1">
                        <NarrowModeContext.Provider value={{ isNarrow }}>
                            {leftPanel}
                        </NarrowModeContext.Provider>
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
