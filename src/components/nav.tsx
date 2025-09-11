'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { NavItem } from '@/config/nav';

interface NavProps {
  items: NavItem[];
  isMinimized: boolean;
}

export function Nav({ items, isMinimized }: NavProps) {
  const pathname = usePathname();

  const getParentPath = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 1) {
      return `/${parts[0]}`;
    }
    return path;
  };

  const parentPath = getParentPath(pathname);

  const getAccordionDefaultValue = () => {
    if (isMinimized) return undefined;
    const activeParent = items.find(
      (item) =>
        item.href === parentPath ||
        (item.items && item.items.some((child) => pathname.startsWith(child.href)))
    );
    return activeParent ? `item-${items.indexOf(activeParent)}` : undefined;
  };

  return (
    <TooltipProvider>
      <nav className="grid items-start gap-1 p-2 text-sm font-medium">
        {items.map((item, index) =>
          item.items ? (
            isMinimized ? (
              <DropdownMenu key={index}>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger
                      className={cn(
                        'flex items-center justify-center gap-3 rounded-md px-3 py-2 text-gray-300 transition-all hover:bg-gray-700 hover:text-white',
                        item.href === parentPath && 'bg-gray-700 text-white'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="sr-only">{item.title}</span>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent side="right">
                  {item.items.map((subItem, subIndex) => (
                    <DropdownMenuItem key={subIndex} asChild>
                      <Link
                        href={subItem.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 transition-all',
                          pathname === subItem.href
                            ? 'bg-muted text-primary'
                            : 'text-muted-foreground hover:text-primary'
                        )}
                      >
                        {subItem.title}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Accordion
                type="single"
                collapsible
                key={index}
                defaultValue={getAccordionDefaultValue()}
              >
                <AccordionItem value={`item-${index}`} className="border-b-0">
                  <AccordionTrigger
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-gray-300 transition-all hover:bg-gray-700 hover:text-white hover:no-underline'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pl-8 pt-1">
                    <div className="grid gap-1">
                      {item.items.map((subItem, subIndex) => (
                        <Link
                          key={subIndex}
                          href={subItem.href}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 transition-all',
                            pathname === subItem.href
                              ? 'bg-gray-700 text-white'
                              : 'text-gray-400 hover:text-white'
                          )}
                        >
                          {subItem.title}
                        </Link>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )
          ) : (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 transition-all',
                    pathname === item.href
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                    isMinimized && 'justify-center'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className={cn(isMinimized && 'sr-only')}>
                    {item.title}
                  </span>
                </Link>
              </TooltipTrigger>
              {isMinimized && (
                <TooltipContent side="right">{item.title}</TooltipContent>
              )}
            </Tooltip>
          )
        )}
      </nav>
    </TooltipProvider>
  );
}
