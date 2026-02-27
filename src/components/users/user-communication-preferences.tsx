'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { NotificationCategory, NotificationPlatform, User } from '@/lib/types';
import { api } from '@/services/api';
import { Mail, MessageSquare, Phone, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface UserCommunicationPreferencesProps {
    user: User;
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

async function getPlatforms(): Promise<NotificationPlatform[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.NOTIFICATION_PLATFORMS);
        const platforms = Array.isArray(response) ? response : [];
        return platforms.filter((p: NotificationPlatform) => p.is_active);
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

async function getUserPreferences(userId: string): Promise<PreferenceState[]> {
    try {
        const response = await api.get(API_ROUTES.SYSTEM.USER_COMMUNICATION_PREFERENCES, { user_id: userId });
        if (Array.isArray(response)) {
            return response.map((p: any) => ({
                category_slug: p.category_slug,
                channel_slug: p.channel_slug,
                is_enabled: p.is_enabled,
            }));
        }
        return [];
    } catch (error) {
        console.error('Failed to fetch user preferences:', error);
        return [];
    }
}

async function saveUserPreferences(userId: string, preferences: PreferenceState[]): Promise<void> {
    await api.post(API_ROUTES.SYSTEM.USER_COMMUNICATION_PREFERENCES, {
        user_id: userId,
        preferences,
    });
}

export function UserCommunicationPreferences({ user }: UserCommunicationPreferencesProps) {
    const t = useTranslations('UserCommunicationPreferences');
    const { toast } = useToast();
    const [platforms, setPlatforms] = React.useState<NotificationPlatform[]>([]);
    const [categories, setCategories] = React.useState<NotificationCategory[]>([]);
    const [preferences, setPreferences] = React.useState<PreferenceState[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [platformsData, categoriesData, preferencesData] = await Promise.all([
                getPlatforms(),
                getCategories(),
                getUserPreferences(user.id),
            ]);

            setPlatforms(platformsData);
            setCategories(categoriesData);

            const allCombinations: PreferenceState[] = [];
            platformsData.forEach((platform: NotificationPlatform) => {
                categoriesData.forEach((category: NotificationCategory) => {
                    const existing = preferencesData.find(
                        p => p.channel_slug === platform.platform_name && p.category_slug === category.slug
                    );
                    allCombinations.push({
                        channel_slug: platform.platform_name,
                        category_slug: category.slug,
                        is_enabled: existing ? existing.is_enabled : true,
                    });
                });
            });
            setPreferences(allCombinations);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user.id]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const isPreferenceEnabled = (categorySlug: string, channelSlug: string): boolean => {
        const pref = preferences.find(
            p => p.category_slug === categorySlug && p.channel_slug === channelSlug
        );
        return pref ? pref.is_enabled : true;
    };

    const handleToggle = (categorySlug: string, channelSlug: string) => {
        setPreferences(prev =>
            prev.map(p =>
                p.category_slug === categorySlug && p.channel_slug === channelSlug
                    ? { ...p, is_enabled: !p.is_enabled }
                    : p
            )
        );
    };

    const handleCategoryToggle = (categorySlug: string, enabled: boolean) => {
        setPreferences(prev =>
            prev.map(p =>
                p.category_slug === categorySlug
                    ? { ...p, is_enabled: enabled }
                    : p
            )
        );
    };

    const handleChannelToggle = (channelSlug: string, enabled: boolean) => {
        setPreferences(prev =>
            prev.map(p =>
                p.channel_slug === channelSlug
                    ? { ...p, is_enabled: enabled }
                    : p
            )
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveUserPreferences(user.id, preferences);
            toast({
                title: t('toast.successTitle'),
                description: t('toast.saveSuccessDescription'),
            });
        } catch (error) {
            console.error('Failed to save preferences:', error);
            toast({
                variant: 'destructive',
                title: t('toast.errorTitle'),
                description: t('toast.saveErrorDescription'),
            });
        } finally {
            setIsSaving(false);
        }
    };

    const isCategoryEnabled = (categorySlug: string): boolean => {
        const categoryPrefs = preferences.filter(p => p.category_slug === categorySlug);
        return categoryPrefs.some(p => p.is_enabled);
    };

    const isChannelEnabled = (channelSlug: string): boolean => {
        const channelPrefs = preferences.filter(p => p.channel_slug === channelSlug);
        return channelPrefs.some(p => p.is_enabled);
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                        <div className="h-8 bg-muted rounded"></div>
                        <div className="h-8 bg-muted rounded"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">{t('title')}</CardTitle>
                        <CardDescription>{t('description')}</CardDescription>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving} size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? t('saving') : t('save')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left p-2 border-b font-medium text-muted-foreground text-sm">
                                    {t('table.category')}
                                </th>
                                {platforms.map((platform) => {
                                    const Icon = platformIcons[platform.platform_name] || Mail;
                                    return (
                                        <th key={platform.platform_name} className="text-center p-2 border-b font-medium text-muted-foreground text-sm">
                                            <div className="flex flex-col items-center gap-1">
                                                <Icon className="h-4 w-4" />
                                                <span className="text-xs">{platform.platform_name}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category) => (
                                <tr key={category.slug} className="hover:bg-muted/30">
                                    <td className="p-2 border-b">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={isCategoryEnabled(category.slug)}
                                                onCheckedChange={(checked) => handleCategoryToggle(category.slug, !!checked)}
                                            />
                                            <span className="text-sm">{category.name}</span>
                                        </div>
                                    </td>
                                    {platforms.map((platform) => (
                                        <td key={`${category.slug}-${platform.platform_name}`} className="text-center p-2 border-b">
                                            <Checkbox
                                                checked={isPreferenceEnabled(category.slug, platform.platform_name)}
                                                onCheckedChange={() => handleToggle(category.slug, platform.platform_name)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-muted/30">
                                <td className="p-2 border-b font-medium text-sm">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={platforms.every(p => isChannelEnabled(p.platform_name))}
                                            onCheckedChange={(checked) => {
                                                platforms.forEach(p => handleChannelToggle(p.platform_name, !!checked));
                                            }}
                                        />
                                        <span>{t('table.allCategories')}</span>
                                    </div>
                                </td>
                                {platforms.map((platform) => {
                                    const Icon = platformIcons[platform.platform_name] || Mail;
                                    return (
                                        <td key={platform.platform_name} className="text-center p-2 border-b">
                                            <Checkbox
                                                checked={isChannelEnabled(platform.platform_name)}
                                                onCheckedChange={(checked) => handleChannelToggle(platform.platform_name, !!checked)}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
