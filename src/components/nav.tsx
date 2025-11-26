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
import type { NavItem } from '@/config/nav';
import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface NavProps {
  items: NavItem[];
}

export function Nav({ items }: NavProps) {
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
          return effectivePathname.startsWith(subItem.href);
        })
      );
      if (activeItemIndex !== -1) {
        setActiveAccordionItem(`item-${activeItemIndex}`);
      } else {
        setActiveAccordionItem(undefined);
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
      'flex items-center gap-3 rounded-lg px-4 py-2 transition-all font-semibold',
      isActive
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      isSubItem && 'text-sm font-normal pl-8',
      !isSubItem && 'text-base'
    );
    
    const linkContent = (
      <>
        {title}
        {item.items && <ChevronRight className="ml-auto h-4 w-4" />}
      </>
    );
    
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
                  'flex items-center gap-3 rounded-lg px-4 py-2 text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground hover:no-underline font-semibold text-base',
                   isActive && 'text-foreground'
                )}
              >
                {title}
              </AccordionTrigger>
              <AccordionContent className="pl-4 pt-1">
                <div className="grid gap-1">
                  {item.items?.map((subItem) => renderLink(subItem, true))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
    )
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
    <nav className="grid items-start gap-1 px-2 text-sm font-medium">
        {items.map((item, index) =>
          item.items ? renderAccordion(item, index) : renderLink(item)
        )}
      </nav>
  );
}
