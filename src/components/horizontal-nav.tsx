
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
                <NavigationMenuTrigger className={cn(isParentActive && "bg-accent/50")}>
                  <item.icon className="h-4 w-4 mr-2" />
                  {t(item.title as any)}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                    {item.items.map((subItem) => (
                      <ListItem
                        key={subItem.title}
                        title={t(subItem.title as any)}
                        href={`/${locale}${subItem.href}`}
                      >
                        {/* Placeholder for description if you add one */}
                      </ListItem>
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
                  <NavigationMenuLink active={isActive} className={navigationMenuTriggerStyle()}>
                    <item.icon className="h-4 w-4 mr-2" />
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
        <a
          ref={ref}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
