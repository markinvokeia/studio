import type { SVGProps } from 'react';

/**
 * Tooth silhouette icon — styled like a Lucide icon (stroke-based).
 * Use as a drop-in replacement wherever a LucideIcon / React.ElementType is expected.
 */
export function ToothIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Crown dome */}
      <path d="M7 7C7 4.2 9.2 2 12 2s5 2.2 5 5c0 1.5-.6 2.8-1.2 3.8L14 15c-.3 3-.3 5 0 6.5" />
      <path d="M7 7c0 1.5.6 2.8 1.2 3.8L10 15c.3 3 .3 5 0 6.5" />
      {/* Two roots */}
      <path d="M10 21.5c.6-1.5 1.4-3 2-4.5.6 1.5 1.4 3 2 4.5" />
    </svg>
  );
}
