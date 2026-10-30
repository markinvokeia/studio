'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WorkingSedeSelector = () => {
  const t = useTranslations('WorkingSedeSelector');
  const { sedes, activeSede, setActiveSede } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Un usuario con acceso a una sola sede no necesita elegir: se usa esa.
  if (sedes.length <= 1) return null;

  const hasActiveSede = !!activeSede;

  const handleSelect = async (sedeId: string) => {
    setIsSaving(true);
    try {
      await setActiveSede(sedeId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to set active sede:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative rounded-xl h-10 w-10',
            hasActiveSede
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-orange-500/15 text-orange-600 hover:bg-orange-500/25 animate-pulse-slow',
          )}
          title={hasActiveSede ? activeSede!.name : t('selectPrompt')}
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="center" className="w-64 p-0 rounded-xl">
        <div className="px-3 pt-3 pb-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t('title')}
          </p>
          {!hasActiveSede && (
            <p className="text-xs text-orange-600 mt-1">{t('selectPrompt')}</p>
          )}
        </div>
        <Command>
          <CommandList>
            <CommandEmpty>{t('noSedes')}</CommandEmpty>
            <CommandGroup>
              {sedes.map((sede) => (
                <CommandItem key={sede.id} value={sede.name} onSelect={() => handleSelect(sede.id)}>
                  <Check className={cn('mr-2 h-4 w-4', activeSede?.id === sede.id ? 'opacity-100' : 'opacity-0')} />
                  {sede.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
