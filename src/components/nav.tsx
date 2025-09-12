
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
import { useLocale, useTranslations } from 'next-intl';

interface NavProps {
  items: NavItem[];
  isMinimized: boolean;
}

export function Nav({ items, isMinimized }: NavProps) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const locale = useLocale();

  const getParentPath = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 2) { // Adjusted for locale
      return `/${parts.slice(1, 2).join('/')}`;
    }
    return `/${parts[1] || ''}`;
  };

  const parentPath = getParentPath(pathname);
  
  const renderLink = (item: NavItem) => {
    const title = t(item.title as any);
    const effectivePathname = pathname.substring(3) || '/';
    const linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
    const isActive = item.href === '/' ? effectivePathname === item.href : effectivePathname.startsWith(item.href);


    return (
       <Tooltip key={item.href} delayDuration={0}>
        <TooltipTrigger asChild>
            <Link
              href={linkHref}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 transition-all font-semibold',
                isActive
                  ? 'bg-black/20 text-white'
                  : 'text-white hover:bg-black/20 hover:text-white',
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
    const effectivePathname = pathname.substring(3);
    const isActive = item.items?.some(subItem => effectivePathname.startsWith(subItem.href.split('/')[1]));

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
                  'flex items-center gap-3 rounded-md px-3 py-2 text-white transition-all hover:bg-black/20 hover:text-white hover:no-underline font-semibold',
                   isActive && 'bg-black/20 text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-8 pt-1">
                <div className="grid gap-1">
                  {item.items?.map((subItem) => {
                    let linkHref = `/${locale}${subItem.href}`;
                    if (subItem.href.includes('clinic-history')) {
                        linkHref = `/${locale}/clinic-history/1`; // Default user
                    }
                    const isSubItemActive = effectivePathname.startsWith(subItem.href.split('/')[1]);

                    return (
                        <Link
                        key={subItem.href}
                        href={linkHref}
                        className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 transition-all font-semibold',
                            isSubItemActive
                            ? 'bg-black/20 text-white'
                            : 'text-white hover:text-white'
                        )}
                        >
                        {t(subItem.title as any)}
                        </Link>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
    )
  }
  
   const renderDropdown = (item: NavItem, index: number) => {
    const title = t(item.title as any);
    const effectivePathname = pathname.substring(3);
    const isActive = item.items?.some(subItem => effectivePathname.startsWith(subItem.href.split('/')[1]));
     return (
        <DropdownMenu key={index}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger
                  className={cn(
                    'flex w-full items-center justify-center gap-3 rounded-md px-3 py-2 text-white transition-all hover:bg-black/20 hover:text-white font-semibold',
                    isActive && 'bg-black/20 text-white'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="sr-only">{title}</span>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right">
              {item.items?.map((subItem) => {
                let linkHref = `/${locale}${subItem.href}`;
                 if (subItem.href.includes('clinic-history')) {
                    linkHref = `/${locale}/clinic-history/1`; // Default user
                }
                const isSubItemActive = effectivePathname.startsWith(subItem.href.split('/')[1]);
                return (
                    <DropdownMenuItem key={subItem.href} asChild>
                    <Link
                        href={linkHref}
                        className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 transition-all font-semibold',
                        isSubItemActive
                            ? 'bg-muted text-primary'
                            : 'text-muted-foreground hover:text-primary'
                        )}
                    >
                        {t(subItem.title as any)}
                    </Link>
                    </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
     );
   }

  return (
    <TooltipProvider>
      <nav className="grid items-start gap-1 p-2 text-base">
        {items.map((item, index) =>
          item.items 
          ? (isMinimized ? renderDropdown(item, index) : renderAccordion(item, index))
          : renderLink(item)
        )}
      </nav>
    </TooltipProvider>
  );
}
