'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { NotificationCategory, NotificationPlatform, User } from '@/lib/types';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';
import { AlertTriangle, Loader2, Mail, MessageSquare, Phone, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface UserCommunicationPreferencesProps {
    user: User;
    autoSave?: boolean;
    compact?: boolean;
}

interface PreferenceState {
    category_slug: string;
    channel_slug: string;
    is_enabled: boolean;
}

const platformIcons: Record<string, React.ComponentType<any>> = {
    email: Mail,
    sms: MessageSquare,
    whatsapp: Phone,
};

// These throw on failure: a matrix built from a failed load shows everything disabled, and saving
// it (the endpoint replaces the whole set) would wipe the user's real preferences.
async function getPlatforms(signal?: AbortSignal): Promise<NotificationPlatform[]> {
    const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_PLATFORMS, undefined, undefined, { signal });
    const platforms = Array.isArray(response) ? response : [];
    return platforms.filter((p: NotificationPlatform) => p.is_active);
}

async function getCategories(signal?: AbortSignal): Promise<NotificationCategory[]> {
    const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_CATEGORIES, undefined, undefined, { signal });
    return Array.isArray(response) ? response : [];
}

async function getUserPreferences(userId: string, signal?: AbortSignal): Promise<PreferenceState[]> {
    const response = await api.get(API_ROUTES.SYSTEM.USER_COMMUNICATION_PREFERENCES, { user_id: userId }, undefined, { signal });
    if (Array.isArray(response)) {
        return response.map((p: any) => ({
            category_slug: p.category_slug,
            channel_slug: p.channel_slug,
            is_enabled: p.is_enabled,
        }));
    }
    return [];
}

async function saveUserPreferences(userId: string, preferences: PreferenceState[]): Promise<void> {
    await api.post(API_ROUTES.SYSTEM.USER_COMMUNICATION_PREFERENCES, {
        user_id: userId,
        preferences,
    }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
}

export function UserCommunicationPreferences({ user, autoSave = false, compact = false }: UserCommunicationPreferencesProps) {
    const t = useTranslations('UserCommunicationPreferences');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const [preferences, setPreferences] = React.useState<PreferenceState[]>([]);
    const [savingKey, setSavingKey] = React.useState<string | null>(null);

    // Switching users quickly can't show another user's matrix: only the latest load writes.
    const {
        data: { platforms, categories, combinations },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadData,
    } = useDataLoader(
        async (signal) => {
            const [platformsData, categoriesData, preferencesData] = await Promise.all([
                getPlatforms(signal),
                getCategories(signal),
                getUserPreferences(user.id, signal),
            ]);

            const allCombinations: PreferenceState[] = [];
            platformsData.forEach((platform: NotificationPlatform) => {
                categoriesData.forEach((category: NotificationCategory) => {
                    const existing = preferencesData.find(
                        p => p.channel_slug === platform.platform_name && p.category_slug === category.slug
                    );
                    allCombinations.push({
                        channel_slug: platform.platform_name,
                        category_slug: category.slug,
                        is_enabled: existing ? existing.is_enabled : false,
                    });
                });
            });
            return { platforms: platformsData, categories: categoriesData, combinations: allCombinations };
        },
        { platforms: [] as NotificationPlatform[], categories: [] as NotificationCategory[], combinations: [] as PreferenceState[] },
        [user.id]
    );

    React.useEffect(() => {
        setPreferences(combinations);
    }, [combinations]);

    const isPreferenceEnabled = (categorySlug: string, channelSlug: string): boolean => {
        const pref = preferences.find(
            p => p.category_slug === categorySlug && p.channel_slug === channelSlug
        );
        return pref ? pref.is_enabled : false;
    };

    // The endpoint replaces the whole matrix, so saves are serialized: a second click while one is
    // in flight is ignored (the checkboxes are disabled meanwhile) instead of racing it.
    const autoSaveAction = useAsyncAction(
        async (key: string, newPreferences: PreferenceState[], prevPreferences: PreferenceState[]) => {
            setSavingKey(key);
            try {
                await saveUserPreferences(user.id, newPreferences);
            } catch (error) {
                setPreferences(prevPreferences);
                throw error;
            } finally {
                setSavingKey(null);
            }
        },
        { errorTitle: t('toast.saveErrorDescription') }
    );

    const applyChange = (key: string, newPreferences: PreferenceState[]) => {
        if (loadError || autoSaveAction.isPending) return;
        setPreferences(newPreferences);
        if (autoSave) autoSaveAction.run(key, newPreferences, preferences);
    };

    const handleToggle = (categorySlug: string, channelSlug: string) => {
        applyChange(`${categorySlug}-${channelSlug}`, preferences.map(p =>
            p.category_slug === categorySlug && p.channel_slug === channelSlug
                ? { ...p, is_enabled: !p.is_enabled }
                : p
        ));
    };

    const handleCategoryToggle = (categorySlug: string, enabled: boolean) => {
        applyChange(`cat-${categorySlug}`, preferences.map(p =>
            p.category_slug === categorySlug ? { ...p, is_enabled: enabled } : p
        ));
    };

    const handleChannelToggle = (channelSlug: string, enabled: boolean) => {
        applyChange(`ch-${channelSlug}`, preferences.map(p =>
            p.channel_slug === channelSlug ? { ...p, is_enabled: enabled } : p
        ));
    };

    // One change for every channel at once (calling handleChannelToggle per channel would compute
    // each from the same stale state and only the last one would stick).
    const handleAllToggle = (enabled: boolean) => {
        applyChange('all', preferences.map(p => ({ ...p, is_enabled: enabled })));
    };

    const save = useAsyncAction(
        () => saveUserPreferences(user.id, preferences),
        {
            onSuccess: () => {
                toast({
                    title: t('toast.successTitle'),
                    description: t('toast.saveSuccessDescription'),
                });
            },
            errorTitle: t('toast.saveErrorDescription'),
        }
    );

    const isBusy = savingKey !== null || save.isPending;

    const isCategoryEnabled = (categorySlug: string): boolean => {
        const categoryPrefs = preferences.filter(p => p.category_slug === categorySlug);
        return categoryPrefs.some(p => p.is_enabled);
    };

    const isChannelEnabled = (channelSlug: string): boolean => {
        const channelPrefs = preferences.filter(p => p.channel_slug === channelSlug);
        return channelPrefs.some(p => p.is_enabled);
    };

    const table = (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="text-left p-2 border-b font-medium text-muted-foreground text-sm">
                            {t('table.category')}
                        </th>
                        {platforms.map((platform) => {
                            const Icon = platformIcons[platform.platform_name] || Mail;
                            const key = `ch-${platform.platform_name}`;
                            return (
                                <th key={platform.platform_name} className="text-center p-2 border-b font-medium text-muted-foreground text-sm">
                                    <div className="flex flex-col items-center gap-1">
                                        {savingKey === key
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Icon className="h-4 w-4" />
                                        }
                                        <span className="text-xs">{platform.platform_name}</span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {loadError ? (
                        <tr>
                            <td colSpan={platforms.length + 1} className="p-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    <span>{tCommon('loadError')}</span>
                                    <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => loadData()} loading={isRefreshing}>
                                        {tCommon('retry')}
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ) : isLoading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i}>
                                <td className="p-2 border-b"><Skeleton className="h-4 w-28" /></td>
                                {[1, 2, 3].map(j => (
                                    <td key={j} className="text-center p-2 border-b"><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
                                ))}
                            </tr>
                        ))
                        : categories.map((category) => {
                            const catKey = `cat-${category.slug}`;
                            return (
                                <tr key={category.slug} className="hover:bg-muted/30">
                                    <td className="p-2 border-b">
                                        <div className="flex items-center gap-2">
                                            {savingKey === catKey
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                : <Checkbox
                                                    checked={isCategoryEnabled(category.slug)}
                                                    onCheckedChange={(checked) => handleCategoryToggle(category.slug, !!checked)}
                                                    disabled={isBusy}
                                                />
                                            }
                                            <span className="text-sm">{category.name}</span>
                                        </div>
                                    </td>
                                    {platforms.map((platform) => {
                                        const cellKey = `${category.slug}-${platform.platform_name}`;
                                        return (
                                            <td key={cellKey} className="text-center p-2 border-b">
                                                {savingKey === cellKey
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mx-auto" />
                                                    : <Checkbox
                                                        checked={isPreferenceEnabled(category.slug, platform.platform_name)}
                                                        onCheckedChange={() => handleToggle(category.slug, platform.platform_name)}
                                                        disabled={isBusy}
                                                    />
                                                }
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    }
                </tbody>
                {!compact && !loadError && (
                    <tfoot>
                        <tr className="bg-muted/30">
                            <td className="p-2 border-b font-medium text-sm">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={platforms.every(p => isChannelEnabled(p.platform_name))}
                                        onCheckedChange={(checked) => handleAllToggle(!!checked)}
                                        disabled={isBusy}
                                    />
                                    <span>{t('table.allCategories')}</span>
                                </div>
                            </td>
                            {platforms.map((platform) => (
                                <td key={platform.platform_name} className="text-center p-2 border-b">
                                    <Checkbox
                                        checked={isChannelEnabled(platform.platform_name)}
                                        onCheckedChange={(checked) => handleChannelToggle(platform.platform_name, !!checked)}
                                        disabled={isBusy}
                                    />
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );

    if (compact) {
        return table;
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription>{t('description')}</CardDescription>
                    </div>
                    <Button onClick={() => save.run()} disabled={isLoading || !!loadError || savingKey !== null} loading={save.isPending} size="sm">
                        {!save.isPending && <Save className="h-4 w-4 mr-2" />}
                        {t('save')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>{table}</CardContent>
        </Card>
    );
}
