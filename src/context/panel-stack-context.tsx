'use client';

import * as React from 'react';

export interface PanelFrame {
  id: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
}

interface PanelStackContextType {
  panelStack: PanelFrame[];
  activePanel: PanelFrame | null;
  pushPanel: (frame: Omit<PanelFrame, 'id'>) => void;
  popPanel: () => void;
  replacePanel: (frame: Omit<PanelFrame, 'id'>) => void;
  clearPanels: () => void;
}

const PanelStackContext = React.createContext<PanelStackContextType | undefined>(undefined);

let _idCounter = 0;
const nextId = () => `panel-${++_idCounter}`;

export function PanelStackProvider({ children }: { children: React.ReactNode }) {
  const [panelStack, setPanelStack] = React.useState<PanelFrame[]>([]);

  const activePanel = panelStack.length > 0 ? panelStack[panelStack.length - 1] : null;

  const pushPanel = React.useCallback((frame: Omit<PanelFrame, 'id'>) => {
    setPanelStack((prev) => [...prev, { ...frame, id: nextId() }]);
  }, []);

  const popPanel = React.useCallback(() => {
    setPanelStack((prev) => prev.slice(0, -1));
  }, []);

  const replacePanel = React.useCallback((frame: Omit<PanelFrame, 'id'>) => {
    setPanelStack((prev) => [...prev.slice(0, -1), { ...frame, id: nextId() }]);
  }, []);

  const clearPanels = React.useCallback(() => {
    setPanelStack([]);
  }, []);

  return (
    <PanelStackContext.Provider value={{ panelStack, activePanel, pushPanel, popPanel, replacePanel, clearPanels }}>
      {children}
    </PanelStackContext.Provider>
  );
}

export function usePanelStack() {
  const ctx = React.useContext(PanelStackContext);
  if (!ctx) throw new Error('usePanelStack must be used within PanelStackProvider');
  return ctx;
}
