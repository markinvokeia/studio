'use client';

import * as React from 'react';
import { DetailPanel } from '@/components/ui/detail-panel';
import { usePanelStack, type PanelFrame } from '@/context/panel-stack-context';

interface PanelStackRendererProps {
  /**
   * Render function for each panel frame.
   * Called for the active (top) panel only — deeper panels render as peek shadows.
   */
  renderPanel: (frame: PanelFrame, depth: number) => React.ReactNode;
}

/**
 * Renders the PanelStack from context as layered DetailPanel components.
 * Place this as the `rightPanel` slot inside a two-panel layout.
 */
export function PanelStackRenderer({ renderPanel }: PanelStackRendererProps) {
  const { panelStack, popPanel } = usePanelStack();

  if (panelStack.length === 0) return null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {panelStack.map((frame, index) => {
        const depth = panelStack.length - 1 - index;
        const isActive = depth === 0;
        return (
          <DetailPanel
            key={frame.id}
            isOpen={isActive}
            onClose={popPanel}
            depth={depth}
            totalDepth={panelStack.length}
          >
            {renderPanel(frame, depth)}
          </DetailPanel>
        );
      })}
    </div>
  );
}
