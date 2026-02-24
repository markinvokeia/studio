'use client';

import { UserCommunicationPreferences } from '@/components/users/user-communication-preferences';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function UserPreferencesPage() {
    const t = useTranslations('UserCommunicationPreferences');
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return (
        <div className="container mx-auto py-6">
            <UserCommunicationPreferences user={user as any} />
        </div>
    );
}
