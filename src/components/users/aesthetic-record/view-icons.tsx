import React from 'react';

import type { AestheticMapView } from '@/lib/types';

/** Silhouette of a map view, so the view switch can be icon-only */
export function ViewIcon({ view, className }: { view: AestheticMapView; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {view === 'front' && (
        <>
          <ellipse cx="12" cy="10" rx="5" ry="6.5" />
          <path d="M5 21.5c.5-3 3.5-4.5 7-4.5s6.5 1.5 7 4.5" />
          <circle cx="10" cy="9.5" r="0.5" fill="currentColor" />
          <circle cx="14" cy="9.5" r="0.5" fill="currentColor" />
        </>
      )}
      {(view === 'left' || view === 'right') && (
        // Drawn facing right; the left profile is its mirror image
        <g transform={view === 'left' ? 'translate(24 0) scale(-1 1)' : undefined}>
          <path d="M6.5 12C6.5 7.5 9 4.5 12.5 4.5c2.8 0 4.5 1.8 4.7 4.1L18.8 12l-1.7.9V15l-.9 1.2.2 1.4c-.6.8-2.2 1-3.9 1" />
          <path d="M6.5 12c0 2.5 1.5 4.5 4 5.8" />
          <path d="M10.5 18.6V21.5M14 18.6V21.5" />
        </g>
      )}
      {(view === 'bodyFront' || view === 'bodyBack') && (
        <>
          <circle cx="12" cy="5" r="2.5" />
          <path d="M7.5 21.5v-9a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v9" />
          {view === 'bodyBack' && <path d="M12 10.5v11" />}
        </>
      )}
    </svg>
  );
}

const makeViewIcon = (view: AestheticMapView) => {
  const Icon = ({ className }: { className?: string }) => <ViewIcon view={view} className={className} />;
  Icon.displayName = `ViewIcon(${view})`;
  return Icon;
};

/** Stable icon components per view, for controls that take an `icon` component */
export const VIEW_ICONS: Record<AestheticMapView, React.ElementType> = {
  front: makeViewIcon('front'),
  left: makeViewIcon('left'),
  right: makeViewIcon('right'),
  bodyFront: makeViewIcon('bodyFront'),
  bodyBack: makeViewIcon('bodyBack'),
};
