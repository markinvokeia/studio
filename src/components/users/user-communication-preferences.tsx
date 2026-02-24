'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { User, UserCommunicationPreference } from '@/lib/types';
import { api } from '@/services/api';
import { Mail, MessageSquare, Phone, Save, Send } from 'lucide-react';
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

const CHANNELS = [
    { slug: 'email', name: 'Email', icon: Mail },
    { slug: 'sms', name: 'SMS', icon: MessageSquare },
    { slug: 'whatsapp', name: 'WhatsApp', icon: Phone },
];

const CATEGORIES = [
    { slug: 'appointments', key: 'appointments' },
    { slug: 'invoices', key: 'invoices' },
    { slug: 'marketing', key: 'marketing' },
];

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
    const [preferences, setPreferences] = React.useState<PreferenceState[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    const loadPreferences = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getUserPreferences(user.id);
            
            const allCombinations: PreferenceState[] = [];
            CHANNELS.forEach(channel => {
                CATEGORIES.forEach(category => {
                    const existing = data.find(
                        p => p.channel_slug === channel.slug && p.category_slug === category.slug
                    );
                    allCombinations.push({
                        channel_slug: channel.slug,
                        category_slug: category.slug,
                        is_enabled: existing ? existing.is_enabled : true,
                    });
                });
            });
            setPreferences(allCombinations);
        } catch (error) {
            console.error('Failed to load preferences:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user.id]);

    React.useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

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
                                {CHANNELS.map(channel => {
                                    const Icon = channel.icon;
                                    return (
                                        <th key={channel.slug} className="text-center p-2 border-b font-medium text-muted-foreground text-sm">
                                            <div className="flex flex-col items-center gap-1">
                                                <Icon className="h-4 w-4" />
                                                <span className="text-xs">{channel.name}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {CATEGORIES.map(category => (
                                <tr key={category.slug} className="hover:bg-muted/30">
                                    <td className="p-2 border-b">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={isCategoryEnabled(category.slug)}
                                                onCheckedChange={(checked) => handleCategoryToggle(category.slug, !!checked)}
                                            />
                                            <span className="text-sm">{t(`categories.${category.key}`)}</span>
                                        </div>
                                    </td>
                                    {CHANNELS.map(channel => (
                                        <td key={`${category.slug}-${channel.slug}`} className="text-center p-2 border-b">
                                            <Checkbox
                                                checked={isPreferenceEnabled(category.slug, channel.slug)}
                                                onCheckedChange={() => handleToggle(category.slug, channel.slug)}
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
                                            checked={CHANNELS.every(c => isChannelEnabled(c.slug))}
                                            onCheckedChange={(checked) => {
                                                CHANNELS.forEach(c => handleChannelToggle(c.slug, !!checked));
                                            }}
                                        />
                                        <span>{t('table.allCategories')}</span>
                                    </div>
                                </td>
                                {CHANNELS.map(channel => {
                                    const Icon = channel.icon;
                                    return (
                                        <td key={channel.slug} className="text-center p-2 border-b">
                                            <Checkbox
                                                checked={isChannelEnabled(channel.slug)}
                                                onCheckedChange={(checked) => handleChannelToggle(channel.slug, !!checked)}
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
