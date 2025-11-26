
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import type { NavItem } from '@/config/nav';
import { useLocale, useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface HorizontalNavProps {
  items: NavItem[];
}

export function HorizontalNav({ items }: HorizontalNavProps) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const locale = useLocale();
  
  const getEffectivePathname = (p: string, l: string) => {
    const localePrefix = `/${l}`;
    if (p.startsWith(localePrefix)) {
      return p.substring(localePrefix.length) || '/';
    }
    return p;
  };

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {items.map((item) => {
          const effectivePathname = getEffectivePathname(pathname, locale);
          if (item.items) {
            const isParentActive = item.items.some(subItem => 
              subItem.href !== '/' && effectivePathname.startsWith(subItem.href)
            );

            return (
              <NavigationMenuItem key={item.title}>
                <NavigationMenuTrigger className={cn("text-sm", isParentActive && "bg-accent/50")}>
                  {t(item.title as any)}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <li className="row-span-3">
                      <NavigationMenuLink asChild>
                        <a
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                          href={`/${locale}${item.href}`}
                        >
                          <item.icon className="h-6 w-6" />
                          <div className="mb-2 mt-4 text-lg font-medium">
                            {t(item.title as any)}
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            {/* Placeholder for parent item description */}
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                    {item.items.map((subItem) => (
                       <ListItem
                        key={subItem.title}
                        title={t(subItem.title as any)}
                        href={`/${locale}${subItem.href}`}
                        className={effectivePathname.startsWith(subItem.href) ? 'bg-accent/50' : ''}
                      />
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          } else {
            let linkHref = `/${locale}${item.href === '/' ? '' : item.href}`;
             if (item.href.includes('/clinic-history')) {
                linkHref = `/${locale}/clinic-history/1`; // Default user
            }

            const isActive = item.href === '/' 
              ? effectivePathname === '/' 
              : effectivePathname.startsWith(item.href);

            return (
              <NavigationMenuItem key={item.title}>
                  <Link href={linkHref} legacyBehavior passHref>
                    <NavigationMenuLink active={isActive} className={cn(navigationMenuTriggerStyle(), "text-sm")}>
                        {t(item.title as any)}
                    </NavigationMenuLink>
                  </Link>
              </NavigationMenuItem>
            );
          }
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
          href={props.href || ''}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
