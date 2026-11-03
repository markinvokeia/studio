
'use client';

import examples from 'libphonenumber-js/examples.mobile.json';
import { CountryCode, Examples, getCountryCallingCode, getExampleNumber, type PhoneNumber } from 'libphonenumber-js/min';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { countries, DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { formatPhoneForDisplay, parsePhoneText, reinterpretForCountry } from '@/lib/phone-text';
import { cn } from '@/lib/utils';
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

export type PhoneInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, 'onChange'> & {
  value?: string;
  onChange: (value: string) => void;
  defaultCountry?: CountryCode;
};

export const PhoneInput: React.FC<PhoneInputProps> = ({
  className,
  value: valueProp,
  onChange,
  onBlur,
  onPaste,
  defaultCountry = DEFAULT_PHONE_COUNTRY,
  ...rest
}) => {
  const [open, setOpen] = React.useState(false);
  const [country, setCountry] = React.useState<CountryCode>(defaultCountry);
  const [inputValue, setInputValue] = React.useState('');

  // Último valor que entregó el propio input: el efecto no debe re-sincronizarlo
  // (reformatearlo o vaciarlo) mientras el usuario escribe.
  const lastEmittedRef = React.useRef<string | undefined>(undefined);
  // El próximo onChange viene de un pegado: ahí sí se intenta reconocer el código sin "+".
  const pastedRef = React.useRef(false);
  const [alternative, setAlternative] = React.useState<PhoneNumber | undefined>(undefined);

  const t = useTranslations('PhoneInput');
  const locale = useLocale();
  const countryName = React.useCallback(
    (code: CountryCode) => {
      try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
      } catch {
        return code;
      }
    },
    [locale],
  );

  React.useEffect(() => {
    if (valueProp !== undefined && valueProp === lastEmittedRef.current) return;
    lastEmittedRef.current = undefined;
    setAlternative(undefined);
    if (valueProp) {
      const display = formatPhoneForDisplay(valueProp);
      if (display.country) setCountry(display.country);
      setInputValue(display.text);
    } else {
      setInputValue('');
      setCountry(defaultCountry);
    }
  }, [valueProp, defaultCountry]);

  const emit = (value: string) => {
    lastEmittedRef.current = value;
    onChange(value);
  };

  const handleCountryChange = (countryCode: CountryCode) => {
    setCountry(countryCode);
    setAlternative(undefined);
    const parsed = reinterpretForCountry(inputValue, country, countryCode);
    if (parsed.number) setInputValue(parsed.number.formatNational());
    emit(parsed.value);
    setOpen(false);
  };

  const applyAlternative = (number: PhoneNumber) => {
    if (number.country) setCountry(number.country);
    setInputValue(number.formatNational());
    setAlternative(undefined);
    emit(number.format('E.164'));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    pastedRef.current = true;
    onPaste?.(e);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const pasted = pastedRef.current;
    pastedRef.current = false;
    const parsed = parsePhoneText(text, country, { detectCallingCode: pasted });
    setInputValue(text);
    if ((pasted || text.trim().startsWith('+')) && parsed.number?.country) setCountry(parsed.number.country);
    setAlternative(parsed.alternative);
    emit(parsed.value);
  };

  // El formato nacional se aplica al salir del campo y sólo si el número es válido,
  // para no reescribir lo que el usuario está tecleando.
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parsePhoneText(inputValue, country, { detectCallingCode: true });
    const { number } = parsed;
    if (number?.country && number.isValid()) {
      setCountry(number.country);
      setInputValue(number.formatNational());
    }
    // Una vez formateado (con 0 troncal) ya no se puede volver a detectar: se conserva la sugerencia.
    if (parsed.alternative) setAlternative(parsed.alternative);
    if (parsed.value !== lastEmittedRef.current) emit(parsed.value);
    onBlur?.(e);
  };

  const placeholder = React.useMemo(() => {
    if (country && examples) {
      const example = getExampleNumber(country, examples as Examples);
      if (example) {
        return example.formatNational();
      }
    }
    return 'Phone number';
  }, [country]);


  return (
    <div className={className}>
      <div className="flex">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          {...rest}
          onPaste={handlePaste}
          onBlur={handleBlur}
        />
      </div>
      {alternative?.country && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('ambiguous', {
            country: countryName(alternative.country),
            number: alternative.formatInternational(),
          })}{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => applyAlternative(alternative)}
          >
            {t('useAlternative', { callingCode: alternative.countryCallingCode })}
          </button>
        </p>
      )}
    </div>
  );
};

export * from './input';

