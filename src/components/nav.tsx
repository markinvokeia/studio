
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
import { useTranslations } from 'next-intl';

interface NavProps {
  items: NavItem[];
  isMinimized: boolean;
}

export function Nav({ items, isMinimized }: NavProps) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');

  const getParentPath = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 2) { // Adjusted for locale
      return `/${parts.slice(1, 2).join('/')}`;
    }
    return `/${parts[1] || ''}`;
  };

  const parentPath = getParentPath(pathname);

  const getAccordionDefaultValue = () => {
    if (isMinimized) return undefined;
    const activeParent = items.find(
      (item) =>
        item.href === parentPath ||
        (item.items && item.items.some((child) => pathname.includes(child.href)))
    );
    return activeParent ? `item-${items.indexOf(activeParent)}` : undefined;
  };
  
  const renderLink = (item: NavItem) => {
    const title = t(item.title as any);
    const effectivePathname = pathname.substring(3); // Remove /en or /es
    return (
       <Tooltip key={item.href} delayDuration={0}>
        <TooltipTrigger asChild>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 transition-all',
                (item.href === '/' && effectivePathname === '') || (item.href !== '/' && effectivePathname.startsWith(item.href))
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                isMinimized && 'justify-center'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className={cn(isMinimized && 'sr-only')}>
                {title}
              </span>
            </Link>
        </TooltipTrigger>
        {isMinimized && (
            <TooltipContent side="right">{title}</TooltipContent>
        )}
      </Tooltip>
    );
  }

  const renderAccordion = (item: NavItem, index: number) => {
    const title = t(item.title as any);
    const effectivePathname = pathname.substring(3); // Remove /en or /es
    const isActive = item.items?.some(subItem => effectivePathname.startsWith(subItem.href));

    return (
        <Accordion
            type="single"
            collapsible
            key={index}
            defaultValue={isActive ? `item-${index}`: undefined}
          >
            <AccordionItem value={`item-${index}`} className="border-b-0">
              <AccordionTrigger
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-gray-300 transition-all hover:bg-gray-700 hover:text-white hover:no-underline',
                   isActive && 'bg-gray-700 text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8 pt-1">
                <div className="grid gap-1">
                  {item.items?.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 transition-all',
                        effectivePathname === subItem.href || (subItem.href !== '/' && effectivePathname.startsWith(subItem.href))
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-400 hover:text-white'
                      )}
                    >
                      {t(subItem.title as any)}
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
    )
  }
  
   const renderDropdown = (item: NavItem, index: number) => {
    const title = t(item.title as any);
    const effectivePathname = pathname.substring(3); // Remove /en or /es
    const isActive = item.items?.some(subItem => effectivePathname.startsWith(subItem.href));
     return (
        <DropdownMenu key={index}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger
                  className={cn(
                    'flex w-full items-center justify-center gap-3 rounded-md px-3 py-2 text-gray-300 transition-all hover:bg-gray-700 hover:text-white',
                    isActive && 'bg-gray-700 text-white'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="sr-only">{title}</span>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right">
              {item.items?.map((subItem) => (
                <DropdownMenuItem key={subItem.href} asChild>
                  <Link
                    href={subItem.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 transition-all',
                       effectivePathname.startsWith(subItem.href)
                        ? 'bg-muted text-primary'
                        : 'text-muted-foreground hover:text-primary'
                    )}
                  >
                    {t(subItem.title as any)}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
     );
   }

  return (
    <TooltipProvider>
      <nav className="grid items-start gap-1 p-2 text-sm font-medium">
        {items.map((item, index) =>
          item.items 
          ? (isMinimized ? renderDropdown(item, index) : renderAccordion(item, index))
          : renderLink(item)
        )}
      </nav>
    </TooltipProvider>
  );
}
