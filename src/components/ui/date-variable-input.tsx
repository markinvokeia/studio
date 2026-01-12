'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, addDays, subDays } from 'date-fns';
import { CalendarIcon, Plus, Minus } from 'lucide-react';

interface DateVariableInputProps {
  value: string;
  onChange: (value: string) => void;
  operator: string;
  placeholder?: string;
  className?: string;
}

interface DateVariable {
  id: string;
  label: string;
  value: string;
  description?: string;
}

const DATE_VARIABLES: DateVariable[] = [
  { id: 'TODAY', label: 'Today', value: '{{TODAY}}', description: 'Current date' },
  { id: 'YESTERDAY', label: 'Yesterday', value: '{{TODAY-1}}', description: 'Yesterday' },
  { id: 'TOMORROW', label: 'Tomorrow', value: '{{TODAY+1}}', description: 'Tomorrow' },
  { id: 'WEEK_START', label: 'Week Start', value: '{{WEEK_START}}', description: 'Start of current week' },
  { id: 'WEEK_END', label: 'Week End', value: '{{WEEK_END}}', description: 'End of current week' },
  { id: 'MONTH_START', label: 'Month Start', value: '{{MONTH_START}}', description: 'Start of current month' },
  { id: 'MONTH_END', label: 'Month End', value: '{{MONTH_END}}', description: 'End of current month' },
  { id: 'YEAR_START', label: 'Year Start', value: '{{YEAR_START}}', description: 'Start of current year' },
  { id: 'YEAR_END', label: 'Year End', value: '{{YEAR_END}}', description: 'End of current year' },
];

export const DateVariableInput: React.FC<DateVariableInputProps> = ({
  value,
  onChange,
  operator,
  placeholder,
  className
}) => {
  const isVariableValue = (val: string) => {
    return DATE_VARIABLES.some(v => v.value === val) ||
           val.match(/\{\{.*\}\}/) ||
           val.startsWith('{{TODAY') ||
           val.startsWith('{{WEEK_') ||
           val.startsWith('{{MONTH_') ||
           val.startsWith('{{YEAR_');
  };

  const getInitialTab = () => {
    if (!value) return 'date';
    if (isVariableValue(value)) {
      if (value.match(/\{\{TODAY[+-]\d+\}\}/)) return 'custom';
      return 'variable';
    }
    return 'date';
  };

  const [activeTab, setActiveTab] = React.useState<'date' | 'variable' | 'custom'>(getInitialTab);

  React.useEffect(() => {
    setActiveTab(getInitialTab());
  }, [value]);
  const [customDays, setCustomDays] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => {
    if (value && !value.match(/\{\{.*\}\}/) &&
        !value.startsWith('{{TODAY') && !value.startsWith('{{WEEK_') &&
        !value.startsWith('{{MONTH_') && !value.startsWith('{{YEAR_')) {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
  });

  // Don't show input for IS NULL and IS NOT NULL operators
  if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
    return null;
  }

  // For IN and NOT IN operators with dates, show text input for comma-separated dates
  if (operator === 'IN' || operator === 'NOT IN') {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'YYYY-MM-DD, {{TODAY}}, {{TODAY+7}}, ...'}
          className={className}
        />
        <div className="text-xs text-gray-500">
          You can use dates (YYYY-MM-DD) or variables like &#123;&#123;TODAY&#125;&#125;, &#123;&#123;TODAY+7&#125;&#125;, &#123;&#123;WEEK_START&#125;&#125;, etc.
        </div>
      </div>
    );
  }

  // For BETWEEN operator with dates, show two date inputs
  if (operator === 'BETWEEN') {
    return (
      <div className="space-y-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'YYYY-MM-DD AND YYYY-MM-DD'}
          className={className}
        />
        <div className="text-xs text-gray-500">
          Format: date1 AND date2 (e.g., &#123;&#123;TODAY&#125;&#125; AND &#123;&#123;TODAY+7&#125;&#125;)
        </div>
      </div>
    );
  }

  const handleVariableSelect = (variableValue: string) => {
    onChange(variableValue);
    if (variableValue.match(/\{\{TODAY[+-]\d+\}\}/)) {
      setActiveTab('custom');
    } else {
      setActiveTab('variable');
    }
    setSelectedDate(undefined);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && !isNaN(date.getTime())) {
      const dateStr = date.toISOString().split('T')[0];
      onChange(dateStr);
      setSelectedDate(date);
      setActiveTab('date');
    }
  };

  const handleCustomRelative = () => {
    if (customDays === 0) return;
    const variableValue = customDays > 0 ? `{{TODAY+${customDays}}}` : `{{TODAY${customDays}}}`;
    onChange(variableValue);
    setActiveTab('custom');
    setSelectedDate(undefined);
   };

   const getDisplayValue = () => {
    if (!value) return '';

    const variable = DATE_VARIABLES.find(v => v.value === value);
    if (variable) return variable.label;

    // Handle {{TODAY+n}} format
    const todayMatch = value.match(/\{\{TODAY([+-]\d+)?\}\}/);
    if (todayMatch) {
      const days = todayMatch[1] ? parseInt(todayMatch[1]) : 0;
      if (days === 0) return 'Today';
      if (days === 1) return 'Tomorrow';
      if (days === -1) return 'Yesterday';
      return `${days > 0 ? '+' : ''}${days} days from today`;
    }

    if (value === '{{WEEK_START}}') return 'Week Start';
    if (value === '{{WEEK_END}}') return 'Week End';
    if (value === '{{MONTH_START}}') return 'Month Start';
    if (value === '{{MONTH_END}}') return 'Month End';
    if (value === '{{YEAR_START}}') return 'Year Start';
    if (value === '{{YEAR_END}}') return 'Year End';

    return value;
  };

  return (
    <div className="space-y-2">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'date' | 'variable' | 'custom')} className="min-h-[120px]">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="date" className="flex items-center gap-1 text-xs">
            <CalendarIcon className="h-3 w-3" />
            Date
          </TabsTrigger>
          <TabsTrigger value="variable" className="text-xs">Variables</TabsTrigger>
          <TabsTrigger value="custom" className="text-xs">Relative</TabsTrigger>
        </TabsList>
        <TabsContent value="date" className="mt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Select a specific date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-left font-normal h-9 text-sm',
                    !selectedDate && !value && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  <span className="truncate">{selectedDate && !isNaN(selectedDate.getTime()) ? format(selectedDate, 'PPP') : placeholder || 'Pick a date'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </TabsContent>
        <TabsContent value="variable" className="mt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Choose a date variable</label>
            <Select value={isVariableValue(value) ? value : ''} onValueChange={handleVariableSelect}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Choose variable" className="text-sm">
                  {value && isVariableValue(value) && (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-medium truncate text-sm">{getDisplayValue()}</span>
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        Var
                      </Badge>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DATE_VARIABLES.map(variable => (
                  <SelectItem key={variable.id} value={variable.value} className="py-2">
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-sm">{variable.label}</span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {variable.value}
                        </Badge>
                      </div>
                      {variable.description && (
                        <span className="text-xs text-gray-500">{variable.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
        <TabsContent value="custom" className="mt-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Set relative date</label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Today</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDays(Math.max(-365, customDays - 1))}
                  className="h-7 w-7 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 0)}
                  className="w-12 text-center h-7 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDays(Math.min(365, customDays + 1))}
                  className="h-7 w-7 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-xs">days</span>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleCustomRelative}
                disabled={customDays === 0}
                className="h-7 text-xs px-2"
              >
                Apply
              </Button>
            </div>
            {value && value.startsWith('{{TODAY') && (
              <div className="text-xs text-green-600 font-medium">
                Current: {getDisplayValue()}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Current value display */}
      {value && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <span className="text-xs font-medium text-gray-700">Selected:</span>
          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
            {getDisplayValue()}
          </Badge>
        </div>
      )}
    </div>
  );
};