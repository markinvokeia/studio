'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';

const FloatingActions = dynamic(() => import('@/components/floating-actions').then(mod => mod.FloatingActions), {
  ssr: false,
});

export function FloatingActionsWrapper() {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    return <FloatingActions />;
}
