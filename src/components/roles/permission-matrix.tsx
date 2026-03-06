'use client';

import { useToast } from '@/hooks/use-toast';
import { Permission } from '@/lib/types';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsUp, Loader2, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Group permissions by module and submenu
interface PermissionGroup {
    module: string;
    submenus: {
        name: string;
        permissions: Permission[];
    }[];
}

interface PermissionMatrixProps {
    roleId: string;
    onPermissionsChange?: () => void;
}

async function getAllPermissions(): Promise<Permission[]> {
    try {
        const data = await api.get(API_ROUTES.PERMISSIONS);
        const permissionsData = Array.isArray(data) ? data : (data.permissions || data.data || []);
        return permissionsData.map((p: any) => ({
            id: String(p.id),
            name: p.name || 'Unknown Permission',
            action: p.action || 'N/A',
            resource: p.resource || 'N/A',
            description: p.description || '',
            module: p.module || p.modulo || 'General',
            submenu: p.submenu || p.sub_menu || p.resource || 'General',
            permission_code: p.permission_code || p.code || '',
            permission_type: p.permission_type || p.type || 'FUNCIONAL',
            casl_action: p.casl_action || p.action || 'read',
        }));
    } catch (error) {
        console.error("Failed to fetch all permissions:", error);
        return [];
    }
}

async function getPermissionsForRole(roleId: string): Promise<Permission[]> {
    if (!roleId) return [];
    try {
        const data = await api.get(API_ROUTES.ROLE_PERMISSIONS, { role_id: roleId });
        const permissionsData = Array.isArray(data) ? data : (data.role_permissions || data.data || data.result || []);

        return permissionsData.map((apiPerm: any) => ({
            id: apiPerm.permission_id ? String(apiPerm.permission_id) : `perm_${Math.random().toString(36).substr(2, 9)}`,
            name: apiPerm.name || 'Unknown Permission',
            action: apiPerm.action || 'N/A',
            resource: apiPerm.resource || 'N/A',
            description: apiPerm.description || '',
            module: apiPerm.module || 'General',
            submenu: apiPerm.submenu || apiPerm.resource || 'General',
            permission_code: apiPerm.permission_code || '',
            permission_type: apiPerm.permission_type || 'FUNCIONAL',
            casl_action: apiPerm.casl_action || 'read',
        }));
    } catch (error) {
        console.error("Failed to fetch role permissions:", error);
        return [];
    }
}

async function assignPermissionsToRole(roleId: string, permissionIds: string[]) {
    return await api.post(API_ROUTES.ROLE_PERMISSIONS_BULK_ASSIGN, {
        role_id: roleId,
        permission_ids: permissionIds
    });
}

function groupPermissionsByModule(permissions: Permission[]): PermissionGroup[] {
    const moduleMap = new Map<string, Map<string, Permission[]>>();

    permissions.forEach(permission => {
        const module = permission.module || 'General';
        const submenu = permission.submenu || 'General';

        if (!moduleMap.has(module)) {
            moduleMap.set(module, new Map());
        }

        const submenuMap = moduleMap.get(module)!;
        if (!submenuMap.has(submenu)) {
            submenuMap.set(submenu, []);
        }

        submenuMap.get(submenu)!.push(permission);
    });

    // Convert to array and sort
    const groups: PermissionGroup[] = [];
    moduleMap.forEach((submenuMap, module) => {
        const submenus: { name: string; permissions: Permission[] }[] = [];
        submenuMap.forEach((perms, name) => {
            submenus.push({ name, permissions: perms });
        });
        // Sort submenus by name
        submenus.sort((a, b) => a.name.localeCompare(b.name));
        groups.push({ module, submenus });
    });

    // Sort modules by name
    groups.sort((a, b) => a.module.localeCompare(b.module));

    return groups;
}

export function PermissionMatrix({ roleId, onPermissionsChange }: PermissionMatrixProps) {
    const t = useTranslations('RolesPage');
    const tPerm = useTranslations('PermissionsPage');
    const { toast } = useToast();

    const [allPermissions, setAllPermissions] = React.useState<Permission[]>([]);
    const [assignedPermissionIds, setAssignedPermissionIds] = React.useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [hasChanges, setHasChanges] = React.useState(false);
    const [expandedModules, setExpandedModules] = React.useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = React.useState('');

    // Load permissions
    const loadPermissions = React.useCallback(async () => {
        if (!roleId) return;
        setIsLoading(true);

        try {
            const [allPerms, rolePerms] = await Promise.all([
                getAllPermissions(),
                getPermissionsForRole(roleId)
            ]);

            setAllPermissions(allPerms);
            setAssignedPermissionIds(new Set(rolePerms.map(p => p.id)));

            // Expand all modules by default
            const modules = new Set(allPerms.map(p => p.module || 'General'));
            setExpandedModules(modules);
        } catch (error) {
            console.error("Failed to load permissions:", error);
        } finally {
            setIsLoading(false);
        }
    }, [roleId]);

    React.useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    const handlePermissionToggle = (permissionId: string) => {
        setAssignedPermissionIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(permissionId)) {
                newSet.delete(permissionId);
            } else {
                newSet.add(permissionId);
            }
            return newSet;
        });
        setHasChanges(true);
    };

    const handleModuleToggle = (module: string, permissions: Permission[]) => {
        const modulePermIds = permissions.map(p => p.id);
        const allSelected = modulePermIds.every(id => assignedPermissionIds.has(id));

        setAssignedPermissionIds(prev => {
            const newSet = new Set(prev);
            modulePermIds.forEach(id => {
                if (allSelected) {
                    newSet.delete(id);
                } else {
                    newSet.add(id);
                }
            });
            return newSet;
        });
        setHasChanges(true);
    };

    const handleSubmenuToggle = (permissions: Permission[]) => {
        const submenuPermIds = permissions.map(p => p.id);
        const allSelected = submenuPermIds.every(id => assignedPermissionIds.has(id));

        setAssignedPermissionIds(prev => {
            const newSet = new Set(prev);
            submenuPermIds.forEach(id => {
                if (allSelected) {
                    newSet.delete(id);
                } else {
                    newSet.add(id);
                }
            });
            return newSet;
        });
        setHasChanges(true);
    };

    const handleModuleExpand = (module: string) => {
        setExpandedModules(prev => {
            const newSet = new Set(prev);
            if (newSet.has(module)) {
                newSet.delete(module);
            } else {
                newSet.add(module);
            }
            return newSet;
        });
    };

    const handleExpandAll = () => {
        const modules = new Set(allPermissions.map(p => p.module || 'General'));
        setExpandedModules(modules);
    };

    const handleCollapseAll = () => {
        setExpandedModules(new Set());
    };

    const handleSelectAll = () => {
        setAssignedPermissionIds(new Set(allPermissions.map(p => p.id)));
        setHasChanges(true);
    };

    const handleDeselectAll = () => {
        setAssignedPermissionIds(new Set());
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const permissionIds = Array.from(assignedPermissionIds);
            await assignPermissionsToRole(roleId, permissionIds);

            toast({
                title: t('permissionsMatrix.toast.success'),
                description: t('permissionsMatrix.toast.saveSuccess'),
            });

            setHasChanges(false);
            onPermissionsChange?.();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('toast.error'),
                description: error instanceof Error ? error.message : t('permissionsMatrix.toast.saveError'),
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Filter and group permissions
    const filteredPermissions = React.useMemo(() => {
        if (!searchTerm) return allPermissions;
        const lowerSearch = searchTerm.toLowerCase();
        return allPermissions.filter(p =>
            p.name.toLowerCase().includes(lowerSearch) ||
            p.module?.toLowerCase().includes(lowerSearch) ||
            p.submenu?.toLowerCase().includes(lowerSearch) ||
            p.permission_code?.toLowerCase().includes(lowerSearch) ||
            p.description?.toLowerCase().includes(lowerSearch)
        );
    }, [allPermissions, searchTerm]);

    const groupedPermissions = React.useMemo(() => {
        return groupPermissionsByModule(filteredPermissions);
    }, [filteredPermissions]);

    // Calculate statistics
    const stats = React.useMemo(() => {
        const total = allPermissions.length;
        const assigned = assignedPermissionIds.size;
        return { total, assigned };
    }, [allPermissions, assignedPermissionIds]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with stats and actions - Two lines layout */}
            <div className="flex flex-col gap-4">
                {/* Line 1: Total, Search, Save */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm">
                            <span className="text-muted-foreground">{t('permissionsMatrix.total')}: </span>
                            <span className="font-medium">{stats.assigned}</span>
                            <span className="text-muted-foreground"> / {stats.total}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {Math.round((stats.assigned / (stats.total || 1)) * 100)}%
                        </Badge>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <input
                            type="text"
                            placeholder={t('permissionsMatrix.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex h-9 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            size="sm"
                            className="gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {t('permissionsMatrix.save')}
                        </Button>
                    </div>
                </div>

                {/* Line 2: Select/Deselect All, Expand/Collapse */}
                <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            title={t('permissionsMatrix.selectAll')}
                            className="h-9"
                        >
                            <Check className="h-4 w-4 mr-1" />
                            {t('permissionsMatrix.all')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAll}
                            title={t('permissionsMatrix.deselectAll')}
                            className="h-9"
                        >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {t('permissionsMatrix.none')}
                        </Button>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExpandAll}
                            title={t('permissionsMatrix.expandAll')}
                            className="h-9"
                        >
                            <ChevronsUpDown className="h-4 w-4 mr-1" />
                            {t('permissionsMatrix.expand')}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCollapseAll}
                            title={t('permissionsMatrix.collapseAll')}
                            className="h-9"
                        >
                            <ChevronsUp className="h-4 w-4 mr-1" />
                            {t('permissionsMatrix.collapse')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Permission Groups */}
            <div className="space-y-3">
                {groupedPermissions.map((group) => (
                    <Card key={group.module} className="overflow-hidden">
                        <CardHeader
                            className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleModuleExpand(group.module)}
                        >
                            <div className="flex items-center gap-2">
                                {expandedModules.has(group.module) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}

                                <Checkbox
                                    checked={group.submenus.every(submenu =>
                                        submenu.permissions.every(p => assignedPermissionIds.has(p.id))
                                    )}
                                    onCheckedChange={() => handleModuleToggle(group.module, group.submenus.flatMap(s => s.permissions))}
                                    onClick={(e) => e.stopPropagation()}
                                    id={`module-${group.module}`}
                                />

                                <CardTitle className="text-sm font-medium flex-1">
                                    {group.module}
                                </CardTitle>

                                <Badge variant="secondary" className="text-xs">
                                    {group.submenus.reduce((acc, s) => acc + s.permissions.filter(p => assignedPermissionIds.has(p.id)).length, 0)}
                                    {' / '}
                                    {group.submenus.reduce((acc, s) => acc + s.permissions.length, 0)}
                                </Badge>
                            </div>
                        </CardHeader>

                        {expandedModules.has(group.module) && (
                            <CardContent className="p-0 border-t">
                                {group.submenus.map((submenu) => (
                                    <div
                                        key={submenu.name}
                                        className="p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Checkbox
                                                checked={submenu.permissions.every(p => assignedPermissionIds.has(p.id))}
                                                onCheckedChange={() => handleSubmenuToggle(submenu.permissions)}
                                                id={`submenu-${group.module}-${submenu.name}`}
                                            />
                                            <span className="text-sm font-medium text-muted-foreground">
                                                {submenu.name}
                                            </span>
                                            <Badge variant="outline" className="text-xs ml-auto">
                                                {submenu.permissions.filter(p => assignedPermissionIds.has(p.id)).length}
                                                {' / '}
                                                {submenu.permissions.length}
                                            </Badge>
                                        </div>

                                        <div className="grid gap-2 pl-6">
                                            {submenu.permissions.map((permission) => (
                                                <div
                                                    key={permission.id}
                                                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                                                >
                                                    <Checkbox
                                                        checked={assignedPermissionIds.has(permission.id)}
                                                        onCheckedChange={() => handlePermissionToggle(permission.id)}
                                                        id={`perm-${permission.id}`}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <label
                                                            htmlFor={`perm-${permission.id}`}
                                                            className="text-sm font-medium cursor-pointer block truncate"
                                                        >
                                                            {permission.name}
                                                        </label>
                                                        {permission.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {permission.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {permission.permission_code && (
                                                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                {permission.permission_code}
                                                            </code>
                                                        )}
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] uppercase",
                                                                permission.casl_action === 'manage' && "bg-red-50 text-red-700 border-red-200",
                                                                permission.casl_action === 'create' && "bg-blue-50 text-blue-700 border-blue-200",
                                                                permission.casl_action === 'read' && "bg-green-50 text-green-700 border-green-200",
                                                                permission.casl_action === 'update' && "bg-yellow-50 text-yellow-700 border-yellow-200",
                                                                permission.casl_action === 'delete' && "bg-red-50 text-red-700 border-red-200",
                                                            )}
                                                        >
                                                            {permission.casl_action || permission.action}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>

            {groupedPermissions.length === 0 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('permissionsMatrix.noPermissions')}</AlertTitle>
                    <AlertDescription>{t('permissionsMatrix.noPermissionsDescription')}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
