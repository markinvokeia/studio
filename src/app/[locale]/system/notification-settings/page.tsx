'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { GlobalNotificationSetting, NotificationCategory, NotificationPlatform } from '@/lib/types';
import { api } from '@/services/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Mail, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

async function getPlatforms(): Promise<NotificationPlatform[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_PLATFORMS);
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Failed to fetch platforms:', error);
        return [];
    }
}

async function getCategories(): Promise<NotificationCategory[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_CATEGORIES);
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Failed to fetch categories:', error);
        return [];
    }
}

async function getSettings(): Promise<GlobalNotificationSetting[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_SETTINGS);
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return [];
    }
}

async function saveSettings(settings: GlobalNotificationSetting[]): Promise<void> {
    await api.post(API_ROUTES.SYSTEM.NOTIFICATION_SETTINGS_UPSERT, { settings });
}

const platformIcons: Record<string, React.ComponentType<any>> = {
    email: Mail,
    sms: MessageSquare,
    whatsapp: Phone,
};

export default function NotificationSettingsPage() {
    const t = useTranslations('NotificationSettingsPage');
    const { toast } = useToast();
    const [platforms, setPlatforms] = React.useState<NotificationPlatform[]>([]);
    const [categories, setCategories] = React.useState<NotificationCategory[]>([]);
    const [settings, setSettings] = React.useState<GlobalNotificationSetting[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [globalEnabled, setGlobalEnabled] = React.useState(true);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [platformsData, categoriesData, settingsData] = await Promise.all([
                getPlatforms(),
                getCategories(),
                getSettings(),
            ]);
            const activePlatforms = platformsData.filter((p: NotificationPlatform) => p.is_active);
            setPlatforms(activePlatforms);
            setCategories(categoriesData);
            
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
            setSettings(allCombinations);
            
            // Check if all settings are enabled
            const allEnabled = allCombinations.every((s: GlobalNotificationSetting) => s.is_enabled);
            const anyEnabled = allCombinations.some((s: GlobalNotificationSetting) => s.is_enabled);
            setGlobalEnabled(anyEnabled ? allEnabled : true);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.loadErrorDescription'),
            });
        } finally {
            setIsLoading(false);
        }
    }, [t, toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

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

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSettings(settings);
            toast({
                title: t('toast.successTitle'),
                description: t('toast.saveSuccessDescription'),
            });
            loadData();
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.saveErrorDescription'),
            });
        } finally {
            setIsSaving(false);
        }
    };

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
            <Card className="flex-1 flex flex-col min-h-0">
                <CardContent className="flex-1 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>{t('title')}</CardTitle>
                    <CardDescription>{t('description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-6 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5" />
                            <div>
                                <p className="font-medium">{t('masterSwitch.title')}</p>
                                <p className="text-sm text-muted-foreground">{t('masterSwitch.description')}</p>
                            </div>
                        </div>
                        <Button
                            variant={globalEnabled ? 'default' : 'outline'}
                            onClick={handleGlobalToggle}
                        >
                            {globalEnabled ? t('masterSwitch.enabled') : t('masterSwitch.disabled')}
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left p-3 border-b font-medium text-muted-foreground min-w-[200px]">
                                        {t('table.category')}
                                    </th>
                                    {platforms.map(platform => {
                                        const Icon = platformIcons[platform.platform_name] || Mail;
                                        return (
                                            <th key={platform.platform_name} className="text-center p-3 border-b font-medium text-muted-foreground">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Icon className="h-5 w-5" />
                                                    <span className="text-xs">{platform.platform_name}</span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(category => (
                                    <tr key={category.slug} className="hover:bg-muted/30">
                                        <td className="p-3 border-b">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={getCategoryEnabled(category.slug)}
                                                    onCheckedChange={() => handleCategoryToggle(category.slug)}
                                                />
                                                <div>
                                                    <p className="font-medium">{category.name}</p>
                                                    {category.is_critical && (
                                                        <Badge variant="destructive" className="text-xs">
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
                                                    disabled={!globalEnabled}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-muted/30">
                                    <td className="p-3 border-b font-medium">
                                        <div className="flex items-center gap-2">
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
                                                    disabled={!globalEnabled}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex justify-end mt-6">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? t('saving') : t('save')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
