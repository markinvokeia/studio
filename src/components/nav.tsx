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
import React, { useEffect, useState } from 'react';

interface NavProps {
  items: NavItem[];
  isMinimized: boolean;
}

export function Nav({ items, isMinimized }: NavProps) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const locale = useLocale();
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getEffectivePathname = (p: string, l: string) => {
    const localePrefix = `/${l}`;
    if (p.startsWith(localePrefix)) {
      return p.substring(localePrefix.length) || '/';
    }
    return p;
  };

  useEffect(() => {
    if (isClient) {
      const effectivePathname = getEffectivePathname(pathname, locale);
      const activeItemIndex = items.findIndex(item => 
        item.items?.some(subItem => {
          if (subItem.href === '/') return effectivePathname === '/';
          if(subItem.href === '/cashier' && (effectivePathname === '/cashier/sessions' || effectivePathname === '/cashier/cash-points')) return false;
          return effectivePathname.startsWith(subItem.href);
        })
      );
      if (activeItemIndex !== -1) {
        setActiveAccordionItem(`item-${activeItemIndex}`);
      } else {
        const isAnyActive = items.some((item) => 
            item.href === '/' 
            ? effectivePathname === '/' 
            : effectivePathname.startsWith(item.href)
        );
        if (!isAnyActive) {
            setActiveAccordionItem(undefined);
        }
      }
    }
  }, [pathname, locale, items, isClient]);

  const renderLink = (item: NavItem, isSubItem = false) => {
    const title = t(item.title as any);
    const effectivePathname = getEffectivePathname(pathname, locale);
    
    let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
    if (item.href.includes('/clinic-history')) {
        linkHref = `/${locale}/clinic-history/1`; // Default user
    }
    
    const isActive = item.href === '/' 
      ? effectivePathname === '/' 
      : effectivePathname.startsWith(item.href);

    const linkClasses = cn(
      'flex items-center gap-3 rounded-md px-3 py-2 transition-all font-semibold',
      isActive
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      isMinimized && !isSubItem && 'justify-center',
      isSubItem && 'text-sm pl-11',
      !isSubItem && 'text-sm'
    );
    
    const linkContent = (
      <>
        {!isSubItem && <item.icon className="h-4 w-4" />}
        <span className={cn(isMinimized && !isSubItem && 'sr-only')}>
          {title}
        </span>
      </>
    );

    if (isMinimized && !isSubItem) {
        return (
             <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                    <Link href={linkHref} className={linkClasses}>
                        {linkContent}
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
        );
    }
    
    return (
        <Link key={item.href} href={linkHref} className={linkClasses}>
            {linkContent}
        </Link>
    );
  }

  const renderAccordion = (item: NavItem, index: number) => {
    const title = t(item.title as any);
    const effectivePathname = getEffectivePathname(pathname, locale);
    const value = `item-${index}`;
    
    const isActive = item.items?.some(subItem => {
        if (subItem.href === '/') return effectivePathname === '/';
        if (subItem.href === '/cashier' && (effectivePathname === '/cashier/sessions' || effectivePathname === '/cashier/cash-points')) return false;
        return effectivePathname.startsWith(subItem.href);
    });

    return (
        <Accordion
            type="single"
            collapsible
            key={index}
            value={activeAccordionItem}
            onValueChange={setActiveAccordionItem}
          >
            <AccordionItem value={value} className="border-b-0">
              <AccordionTrigger
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:no-underline font-semibold',
                   isActive && 'bg-accent/80 text-accent-foreground',
                   'text-sm'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {title}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-0 pt-1">
                <div className="grid gap-1">
                  {item.items?.map((subItem) => renderLink(subItem, true))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
    )
  }
  
   const renderDropdown = (item: NavItem, index: number) => {
    const title = t(item.title as any);
    const effectivePathname = getEffectivePathname(pathname, locale);
    const isActive = item.items?.some(subItem => effectivePathname.startsWith(subItem.href));
     return (
        <DropdownMenu key={index}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger
                  className={cn(
                    'flex w-full items-center justify-center gap-3 rounded-md px-3 py-2 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground font-semibold',
                    isActive && 'bg-accent/80 text-accent-foreground',
                    'text-sm'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="sr-only">{title}</span>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{title}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start">
              {item.items?.map((subItem) => {
                let linkHref = `/${locale}${subItem.href}`;
                 if (subItem.href.includes('/clinic-history')) {
                    linkHref = `/${locale}/clinic-history/1`; // Default user
                }
                
                const isSubItemActive = effectivePathname === subItem.href;
                
                return (
                    <DropdownMenuItem key={subItem.href} asChild>
                    <Link
                        href={linkHref}
                        className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 transition-all font-semibold',
                        isSubItemActive
                            ? 'bg-muted text-primary'
                            : 'text-muted-foreground hover:text-primary',
                        'text-sm'
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

  if (!isClient) {
    return (
       <nav className="grid items-start gap-1 p-2">
        {items.map((item, index) =>
          <div key={index} className="h-10" />
        )}
      </nav>
    );
  }

  return (
    <TooltipProvider>
      <nav className="grid items-start gap-1 p-2">
        {items.map((item, index) =>
          item.items 
          ? (isMinimized ? renderDropdown(item, index) : renderAccordion(item, index))
          : renderLink(item)
        )}
      </nav>
    </TooltipProvider>
  );
}
