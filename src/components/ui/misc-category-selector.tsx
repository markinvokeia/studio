'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ChevronsUpDown, Loader2, Plus, Tags } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_ROUTES } from '@/constants/routes';
import { MiscellaneousCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const createCategoryFormSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('nameRequired')),
  code: z.string().min(1, t('codeRequired')),
  description: z.string().optional(),
  type: z.enum(['income', 'expense']),
  is_active: z.boolean().default(true),
});

type CreateCategoryFormValues = z.infer<ReturnType<typeof createCategoryFormSchema>>;

interface MiscCategorySelectorProps {
  categories: MiscellaneousCategory[];
  categoryType: 'income' | 'expense';
  value?: string;
  onValueChange: (categoryId: string, category?: MiscellaneousCategory) => void;
  onCategoryCreated?: (category: MiscellaneousCategory) => void;
  placeholder?: string;
  triggerText?: string;
  noResultsText?: string;
  className?: string;
  disabled?: boolean;
}

export function MiscCategorySelector({
  categories,
  categoryType,
  value,
  onValueChange,
  onCategoryCreated,
  placeholder,
  triggerText,
  noResultsText,
  className,
  disabled = false,
}: MiscCategorySelectorProps) {
  const t = useTranslations('ProductCategoriesPage');
  const tValidation = useTranslations('ProductCategoriesPage.validation');
  const tGeneral = useTranslations('General');

  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const form = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategoryFormSchema(tValidation)),
    defaultValues: { name: '', code: '', description: '', type: categoryType, is_active: true },
  });

  const filteredCategories = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const selectedCategory = categories.find((c) => c.id === value);

  const hasExactMatch = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return categories.some((c) => c.name.toLowerCase() === q);
  }, [categories, searchQuery]);

  const handleSelect = (category: MiscellaneousCategory) => {
    onValueChange(category.id, category);
    setOpen(false);
    setSearchQuery('');
  };

  const openCreateDialog = () => {
    form.reset({ name: searchQuery.trim(), code: '', description: '', type: categoryType, is_active: true });
    setCreateError(null);
    setOpen(false);
    setIsCreateOpen(true);
  };

  const onCreateSubmit = async (values: CreateCategoryFormValues) => {
    setIsSaving(true);
    setCreateError(null);
    try {
      const response = await api.post(API_ROUTES.CASHIER.MISCELLANEOUS_CATEGORIES_UPSERT, values);

      if (Array.isArray(response) && response.length > 0) {
        const firstItem = response[0];
        if (firstItem && (firstItem.code >= 400 || firstItem.error)) {
          throw new Error(firstItem.message || firstItem.error || t('toast.saveError'));
        }
      }
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        if (response.error || response.code >= 400) {
          throw new Error(response.message || response.error || t('toast.saveError'));
        }
      }

      const created = Array.isArray(response) ? response[0] : response;
      const newCategory: MiscellaneousCategory = {
        id: String(created?.id ?? ''),
        name: created?.name ?? values.name,
        code: created?.code ?? values.code,
        description: created?.description ?? values.description ?? '',
        type: (created?.category_type ?? created?.type ?? values.type) as 'income' | 'expense',
        is_active: created?.is_active ?? values.is_active,
        created_at: created?.created_at ?? '',
        updated_at: created?.updated_at ?? '',
      };

      onCategoryCreated?.(newCategory);
      onValueChange(newCategory.id, newCategory);
      setIsCreateOpen(false);
      setSearchQuery('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('toast.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className={cn('w-full justify-between font-normal', !selectedCategory && 'text-muted-foreground', className)}
            disabled={disabled}
          >
            <span className="truncate block">{selectedCategory?.name || triggerText || t('filterPlaceholder')}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder || t('filterPlaceholder')} value={searchQuery} onValueChange={setSearchQuery} />
            <CommandList>
              {filteredCategories.length > 0 ? (
                <CommandGroup>
                  {filteredCategories.map((category) => (
                    <CommandItem key={category.id} value={category.name} onSelect={() => handleSelect(category)}>
                      <Check className={cn('mr-2 h-4 w-4', value === category.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{category.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <p className="py-5 text-center text-sm text-muted-foreground">{noResultsText || tGeneral('noResults')}</p>
              )}
              {!hasExactMatch && (
                <div className="border-t">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer text-left"
                    onClick={openCreateDialog}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {searchQuery.trim() ? `${t('dialog.create')} "${searchQuery.trim()}"` : t('dialog.createTitle')}
                    </span>
                  </button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent confirmOnClose isDirty={form.formState.isDirty}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="header-icon-circle mt-0.5">
                <Tags className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left">
                <DialogTitle>{t('dialog.createTitle')}</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4 py-4 px-6">
              {createError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('toast.errorTitle')}</AlertTitle>
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dialog.name')}</FormLabel>
                  <FormControl><Input placeholder={t('dialog.namePlaceholder')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dialog.code')}</FormLabel>
                  <FormControl><Input placeholder={t('dialog.codePlaceholder')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dialog.description')}</FormLabel>
                  <FormControl><Input placeholder={t('dialog.descriptionPlaceholder')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dialog.type')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('dialog.selectType')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="income">{t('dialog.income')}</SelectItem>
                      <SelectItem value="expense">{t('dialog.expense')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel>{t('dialog.isActive')}</FormLabel>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  {t('dialog.create')}
                </Button>
                <DialogCancelButton>{t('dialog.cancel')}</DialogCancelButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MiscCategorySelector;
