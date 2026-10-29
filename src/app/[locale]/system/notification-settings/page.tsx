
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { API_ROUTES } from '@/constants/routes';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useToast } from '@/hooks/use-toast';
import { GlobalNotificationSetting, NotificationCategory, NotificationPlatform } from '@/lib/types';
import { api, isTimeoutError, REQUEST_TIMEOUT_MS } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Mail, MessageSquare, Phone, RefreshCw, Mails } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

// These throw on failure: a matrix built from a failed load shows every channel disabled, and
// saving it (the endpoint replaces the whole set) would switch off every notification.
async function getPlatforms(signal?: AbortSignal): Promise<NotificationPlatform[]> {
    const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_PLATFORMS, undefined, undefined, { signal });
    return Array.isArray(response) ? response : [];
}

async function getCategories(signal?: AbortSignal): Promise<NotificationCategory[]> {
    const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_CATEGORIES, undefined, undefined, { signal });
    return Array.isArray(response) ? response : [];
}

async function getSettings(signal?: AbortSignal): Promise<GlobalNotificationSetting[]> {
    const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_SETTINGS, undefined, undefined, { signal });
    return Array.isArray(response) ? response : [];
}

async function saveSettings(settings: GlobalNotificationSetting[]): Promise<void> {
    await api.post(API_ROUTES.SYSTEM.NOTIFICATION_SETTINGS_UPSERT, { settings }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });
}

const platformIcons: Record<string, React.ComponentType<any>> = {
    email: Mail,
    sms: MessageSquare,
    whatsapp: Phone,
};

export default function NotificationSettingsPage() {
    const t = useTranslations('NotificationSettingsPage');
    const tCommon = useTranslations('Common');
    const { toast } = useToast();
    const [settings, setSettings] = React.useState<GlobalNotificationSetting[]>([]);
    const [globalEnabled, setGlobalEnabled] = React.useState(true);

    // Refetches (after saving) keep the matrix on screen instead of swapping it for a spinner.
    const {
        data: { platforms, categories, combinations },
        isLoading,
        isRefreshing,
        error: loadError,
        reload: loadData,
    } = useDataLoader(
        async (signal) => {
            const [platformsData, categoriesData, settingsData] = await Promise.all([
                getPlatforms(signal),
                getCategories(signal),
                getSettings(signal),
            ]);
            const activePlatforms = platformsData.filter((p: NotificationPlatform) => p.is_active);
            
            // Initialize settings with all platform × category combinations
            const allCombinations: GlobalNotificationSetting[] = [];
            activePlatforms.forEach((platform: NotificationPlatform) => {
                categoriesData.forEach((category: NotificationCategory) => {
                    const existing = settingsData.find(
                        (s: GlobalNotificationSetting) => 
                            s.channel_slug === platform.platform_name && 
                            s.category_slug === category.slug
                    );
                    allCombinations.push({
                        channel_slug: platform.platform_name,
                        category_slug: category.slug,
                        is_enabled: existing ? existing.is_enabled : false,
                    });
                });
            });
            return { platforms: activePlatforms, categories: categoriesData, combinations: allCombinations };
        },
        { platforms: [] as NotificationPlatform[], categories: [] as NotificationCategory[], combinations: [] as GlobalNotificationSetting[] }
    );

    React.useEffect(() => {
        setSettings(combinations);
        // Check if all settings are enabled
        const allEnabled = combinations.every((s: GlobalNotificationSetting) => s.is_enabled);
        const anyEnabled = combinations.some((s: GlobalNotificationSetting) => s.is_enabled);
        setGlobalEnabled(anyEnabled ? allEnabled : true);
    }, [combinations]);

    const isSettingEnabled = (channelSlug: string, categorySlug: string): boolean => {
        const setting = settings.find(
            s => s.channel_slug === channelSlug && s.category_slug === categorySlug
        );
        return setting ? setting.is_enabled : false;
    };

    const handleToggle = (channelSlug: string, categorySlug: string) => {
        setSettings(prev => {
            const existing = prev.find(
                s => s.channel_slug === channelSlug && s.category_slug === categorySlug
            );
            if (existing) {
                return prev.map(s =>
                    s.channel_slug === channelSlug && s.category_slug === categorySlug
                        ? { ...s, is_enabled: !s.is_enabled }
                        : s
                );
            } else {
                return [...prev, { channel_slug: channelSlug, category_slug: categorySlug, is_enabled: true }];
            }
        });
    };

    const handleGlobalToggle = () => {
        const newValue = !globalEnabled;
        setGlobalEnabled(newValue);
        
        setSettings(prev => {
            const updated = [...prev];
            platforms.forEach(platform => {
                categories.forEach(category => {
                    const existingIndex = updated.findIndex(
                        s => s.channel_slug === platform.platform_name && s.category_slug === category.slug
                    );
                    if (existingIndex >= 0) {
                        updated[existingIndex] = { ...updated[existingIndex], is_enabled: newValue };
                    } else if (newValue) {
                        updated.push({
                            channel_slug: platform.platform_name,
                            category_slug: category.slug,
                            is_enabled: true,
                        });
                    }
                });
            });
            return updated;
        });
    };

    const handleCategoryToggle = (categorySlug: string) => {
        const categorySettings = settings.filter(s => s.category_slug === categorySlug);
        const allEnabled = categorySettings.every(s => s.is_enabled);
        const newValue = !allEnabled;

        setSettings(prev => {
            const updated = [...prev];
            platforms.forEach(platform => {
                const existingIndex = updated.findIndex(
                    s => s.channel_slug === platform.platform_name && s.category_slug === categorySlug
                );
                if (existingIndex >= 0) {
                    updated[existingIndex] = { ...updated[existingIndex], is_enabled: newValue };
                } else if (newValue) {
                    updated.push({
                        channel_slug: platform.platform_name,
                        category_slug: categorySlug,
                        is_enabled: true,
                    });
                }
            });
            return updated;
        });
    };

    const handlePlatformToggle = (platformName: string) => {
        const platformSettings = settings.filter(s => s.channel_slug === platformName);
        const allEnabled = platformSettings.every(s => s.is_enabled);
        const newValue = !allEnabled;

        setSettings(prev => {
            const updated = [...prev];
            categories.forEach(category => {
                const existingIndex = updated.findIndex(
                    s => s.channel_slug === platformName && s.category_slug === category.slug
                );
                if (existingIndex >= 0) {
                    updated[existingIndex] = { ...updated[existingIndex], is_enabled: newValue };
                } else if (newValue) {
                    updated.push({
                        channel_slug: platformName,
                        category_slug: category.slug,
                        is_enabled: true,
                    });
                }
            });
            return updated;
        });
    };

    const save = useAsyncAction(
        () => saveSettings(settings),
        {
            onSuccess: async () => {
                toast({
                    title: t('toast.successTitle'),
                    description: t('toast.saveSuccessDescription'),
                });
                await loadData();
            },
            // The change may have been applied before the timeout: show the real state.
            onError: (error) => { if (isTimeoutError(error)) loadData(); },
            errorTitle: t('toast.saveErrorDescription'),
        }
    );
    const isBusy = save.isPending || isRefreshing;

    const getCategoryEnabled = (categorySlug: string): boolean => {
        const categorySettings = settings.filter(s => s.category_slug === categorySlug);
        if (categorySettings.length === 0) return globalEnabled;
        return categorySettings.some(s => s.is_enabled);
    };

    const getPlatformEnabled = (platformName: string): boolean => {
        const platformSettings = settings.filter(s => s.channel_slug === platformName);
        if (platformSettings.length === 0) return globalEnabled;
        return platformSettings.some(s => s.is_enabled);
    };

    const getCellEnabled = (platformName: string, categorySlug: string): boolean => {
        const setting = settings.find(
            s => s.channel_slug === platformName && s.category_slug === categorySlug
        );
        return setting ? setting.is_enabled : globalEnabled;
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-0 items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex-1 p-1">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('toast.loadErrorDescription')}</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-3">
                        <span>{loadError}</span>
                        <Button size="sm" variant="outline" onClick={() => loadData()} loading={isRefreshing}>
                            {tCommon('retry')}
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-4">
            <Card className="shadow-sm border-0">
                <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="header-icon-circle mt-0.5">
                            <Mails className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">{t('title')}</CardTitle>
                            <CardDescription className="text-xs">{t('description')}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 bg-background">
                    <div className="flex items-center justify-between mb-6 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{t('masterSwitch.title')}</p>
                                <p className="text-sm text-muted-foreground">{t('masterSwitch.description')}</p>
                            </div>
                        </div>
                        <Button
                            variant={globalEnabled ? 'default' : 'outline'}
                            onClick={handleGlobalToggle}
                            disabled={isBusy}
                            aria-pressed={globalEnabled}
                        >
                            {globalEnabled ? t('masterSwitch.enabled') : t('masterSwitch.disabled')}
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left p-3 border-b font-bold text-muted-foreground min-w-[200px] uppercase text-xs tracking-wider">
                                        {t('table.category')}
                                    </th>
                                    {platforms.map(platform => {
                                        const Icon = platformIcons[platform.platform_name] || Mail;
                                        return (
                                            <th key={platform.platform_name} className="text-center p-3 border-b font-bold text-muted-foreground uppercase text-xs tracking-wider">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground mb-1">
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <span>{platform.platform_name}</span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(category => (
                                    <tr key={category.slug} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-3 border-b">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    checked={getCategoryEnabled(category.slug)}
                                                    onCheckedChange={() => handleCategoryToggle(category.slug)}
                                                    disabled={isBusy}
                                                />
                                                <div>
                                                    <p className="font-bold text-foreground text-sm">{category.name}</p>
                                                    {category.is_critical && (
                                                        <Badge variant="destructive" className="text-[10px] uppercase py-0 px-1 mt-1">
                                                            {t('critical')}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {platforms.map(platform => (
                                            <td key={`${platform.platform_name}-${category.slug}`} className="text-center p-3 border-b">
                                                <Checkbox
                                                    checked={getCellEnabled(platform.platform_name, category.slug)}
                                                    onCheckedChange={() => handleToggle(platform.platform_name, category.slug)}
                                                    disabled={!globalEnabled || isBusy}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/30">
                                    <td className="p-3 border-b font-bold text-sm">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                checked={platforms.every(p => getPlatformEnabled(p.platform_name))}
                                                onCheckedChange={() => {
                                                    const allEnabled = platforms.every(p => getPlatformEnabled(p.platform_name));
                                                    platforms.forEach(p => {
                                                        if (!allEnabled !== !getPlatformEnabled(p.platform_name)) {
                                                            handlePlatformToggle(p.platform_name);
                                                        }
                                                    });
                                                }}
                                                disabled={isBusy}
                                            />
                                            <span>{t('table.allPlatforms')}</span>
                                        </div>
                                    </td>
                                    {platforms.map(platform => {
                                        const Icon = platformIcons[platform.platform_name] || Mail;
                                        return (
                                            <td key={platform.platform_name} className="text-center p-3 border-b">
                                                <Checkbox
                                                    checked={getPlatformEnabled(platform.platform_name)}
                                                    onCheckedChange={() => handlePlatformToggle(platform.platform_name)}
                                                    disabled={!globalEnabled || isBusy}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex justify-end mt-6">
                        <Button onClick={() => save.run()} disabled={isRefreshing} loading={save.isPending} className="font-bold uppercase tracking-wider">
                            {t('save')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
