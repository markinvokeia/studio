import {ReactNode} from 'react';

// The app's root layout, which applies to all locales.
// This is a great place to add metadata, fonts, and other global styles.
// https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates#root-layout-required
export default function RootLayout({children}: {children: ReactNode}) {
  return children;
}
