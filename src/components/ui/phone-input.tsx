
'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import { AsYouType, CountryCode, getCountryCallingCode } from 'libphonenumber-js/min';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '.';
import { ScrollArea } from './scroll-area';
import { cn } from '@/lib/utils';
import { countries } from '@/lib/countries';

export type PhoneInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, 'onChange'> & {
  value?: string;
  onChange: (value: string) => void;
  defaultCountry?: CountryCode;
};

export const PhoneInput: React.FC<PhoneInputProps> = ({
  className,
  value: valueProp,
  onChange,
  defaultCountry = 'US',
  ...rest
}) => {
  const [open, setOpen] = React.useState(false);
  const [country, setCountry] = React.useState<CountryCode>(defaultCountry);
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    if (valueProp) {
      const asYouType = new AsYouType(country);
      asYouType.input(valueProp);
      if (asYouType.country) {
        setCountry(asYouType.country);
      }
      setInputValue(asYouType.getNumber()?.format('NATIONAL') || '');
    } else {
        setInputValue('');
        setCountry(defaultCountry);
    }
  }, [valueProp, country, defaultCountry]);

  const handleCountryChange = (countryCode: CountryCode) => {
    const callingCode = getCountryCallingCode(countryCode);
    const newPhoneNumber = `+${callingCode} ${inputValue.split(' ').slice(1).join(' ')}`;
    const asYouType = new AsYouType(countryCode);
    asYouType.input(newPhoneNumber);
    setCountry(countryCode);
    onChange(asYouType.getNumber()?.format('E.164') || '');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const asYouType = new AsYouType(country);
    asYouType.input(e.target.value);
    setInputValue(e.target.value);
    onChange(asYouType.getNumber()?.format('E.164') || '');
  };

  return (
    <div className={cn('flex', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-max justify-start rounded-e-none"
          >
            {country ? `+${getCountryCallingCode(country)}` : 'Select country'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandList>
              <ScrollArea className="h-56">
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {countries.map((c) => (
                    <CommandItem
                      key={c.value}
                      value={`${c.label} (+${getCountryCallingCode(c.value)})`}
                      onSelect={() => handleCountryChange(c.value)}
                    >
                      <Check className={cn('mr-2 h-4 w-4', country === c.value ? 'opacity-100' : 'opacity-0')} />
                      {c.label}
                      <span className="ml-auto text-gray-400">{`+${getCountryCallingCode(c.value)}`}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        className="rounded-s-none"
        placeholder="Phone number"
        value={inputValue}
        onChange={handleInputChange}
        {...rest}
      />
    </div>
  );
};

export * from './input';
