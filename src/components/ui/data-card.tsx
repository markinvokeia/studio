import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataCardField {
  label: string;
  value: React.ReactNode;
  /** If true, renders value prominently (larger/bolder) */
  primary?: boolean;
}

interface DataCardProps {
  /** Generic field-value pairs (used when title/subtitle not provided) */
  fields?: DataCardField[];
  /** Primary display name — rendered bold at top */
  title?: string;
  /** Secondary line below title */
  subtitle?: string;
  /** Optional status badge displayed after title */
  badge?: React.ReactNode;
  /** Avatar: pass initials string or a ReactNode */
  avatar?: string | React.ReactNode;
  /** Optional action strip rendered at the bottom-right */
  actions?: React.ReactNode;
  /** Called when the card body itself is clicked */
  onClick?: () => void;
  className?: string;
  /** Optional left accent color (CSS color string) */
  accentColor?: string;
  /** Highlights the card with a primary border (selected state) */
  isSelected?: boolean;
  /** Show a navigation arrow on the right edge */
  showArrow?: boolean;
}

/**
 * Compact card replacing table rows in narrow-mode list views.
 * Supports two layouts:
 *  - "List item" (when `title` is provided): avatar + name + subtitle, like the reference design
 *  - "Field grid" (when only `fields` is provided): label/value pairs
 */
export function DataCard({
  fields,
  title,
  subtitle,
  badge,
  avatar,
  actions,
  onClick,
  className,
  accentColor,
  isSelected,
  showArrow,
}: DataCardProps) {
  const isListItem = !!title;

  const avatarEl = React.useMemo(() => {
    if (!avatar) return null;
    if (typeof avatar === 'string') {
      return (
        <div className="flex-none w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold uppercase select-none">
          {avatar.slice(0, 2)}
        </div>
      );
    }
    return avatar;
  }, [avatar]);

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-all duration-150',
        onClick && 'cursor-pointer hover:shadow-md',
        isSelected
          ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20 shadow-md'
          : 'border-border hover:border-border/80',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {accentColor && (
        <span
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
          style={{ backgroundColor: accentColor }}
        />
      )}

      {/* Avatar */}
      {avatarEl && <div className="flex-none">{avatarEl}</div>}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isListItem ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-foreground truncate leading-tight">
                {title}
              </span>
              {badge && <span className="flex-none">{badge}</span>}
            </div>
            {subtitle && (
              <span className="text-[11px] text-muted-foreground truncate block mt-0.5">
                {subtitle}
              </span>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            {(fields ?? []).map((field, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">{field.label}</span>
                <span
                  className={cn(
                    'truncate text-right',
                    field.primary ? 'text-sm font-semibold text-foreground' : 'text-xs text-foreground',
                  )}
                >
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        )}
        {actions && (
          <div className="flex items-center gap-1 pt-1.5 mt-1 border-t border-border/50">
            {actions}
          </div>
        )}
      </div>

      {/* Arrow */}
      {(showArrow || onClick) && (
        <div className={cn(
          'flex-none h-6 w-6 rounded-full flex items-center justify-center transition-colors',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground group-hover:bg-primary/10',
        )}>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
