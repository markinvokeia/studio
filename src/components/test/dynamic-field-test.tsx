'use client';

import { DynamicFieldInput } from '@/components/ui/dynamic-field-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TEST_FIELDS = [
  { name: 'id', type: 'int' },
  { name: 'user_id', type: 'int' },
  { name: 'customer_id', type: 'varchar' },
  { name: 'patient_id', type: 'bigint' },
  { name: 'name', type: 'varchar' },
  { name: 'email', type: 'varchar' },
  { name: 'created_by', type: 'int' },
  { name: 'owner_id', type: 'int' },
  { name: 'created_at', type: 'timestamp' },
  { name: 'updated_at', type: 'datetime' },
  { name: 'is_active', type: 'boolean' },
  { name: 'price', type: 'decimal' },
  { name: 'birth_date', type: 'date' },
  { name: 'appointment_date', type: 'date' },
  { name: 'next_payment_date', type: 'date' },
];

const OPERATORS = {
  int: ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL', 'IN', 'NOT IN', 'BETWEEN'],
  varchar: ['=', '!=', 'contains', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL', 'IN', 'NOT IN'],
  timestamp: ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL', 'IN', 'NOT IN', 'BETWEEN'],
  boolean: ['=', '!=', 'IS NULL', 'IS NOT NULL'],
  decimal: ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL', 'IN', 'NOT IN', 'BETWEEN'],
  date: ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL', 'IN', 'NOT IN', 'BETWEEN'],
};

export default function DynamicFieldTest() {
  const [selectedField, setSelectedField] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [value, setValue] = useState('');

  const fieldType = TEST_FIELDS.find(f => f.name === selectedField)?.type || '';
  const availableOperators = fieldType ? OPERATORS[fieldType as keyof typeof OPERATORS] || [] : [];

  const resetTest = () => {
    setSelectedField('');
    setSelectedOperator('');
    setValue('');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dynamic Field Input Test</CardTitle>
          <CardDescription>
            Test the dynamic input components for different data types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Field</label>
              <Select value={selectedField} onValueChange={(val) => {
                setSelectedField(val);
                setSelectedOperator('');
                setValue('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {TEST_FIELDS.map(field => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.name} ({field.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Operator</label>
              <Select value={selectedOperator} onValueChange={(val) => {
                setSelectedOperator(val);
                setValue('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an operator" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map(op => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Value</label>
              <DynamicFieldInput
                value={value}
                onChange={setValue}
                fieldType={fieldType}
                operator={selectedOperator}
                placeholder="Enter value"
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-2">Current State:</h3>
            <div className="bg-gray-100 p-3 rounded text-sm font-mono">
              Field: {selectedField || 'None'}<br/>
              Type: {fieldType || 'None'}<br/>
              Operator: {selectedOperator || 'None'}<br/>
              Value: {value || 'None'}
            </div>
          </div>

          <Button onClick={resetTest} variant="outline">
            Reset Test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expected Behaviors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><strong>Date/Timestamp fields:</strong> Should show date input with variables support</div>
          <div><strong>Date variables:</strong> TODAY, TODAY+N, WEEK_START, MONTH_END, etc.</div>
          <div><strong>Boolean fields:</strong> Should show dropdown with True/False options</div>
          <div><strong>Numeric fields:</strong> Should show number input with appropriate step</div>
          <div><strong>String fields:</strong> Should show text input</div>
          <div><strong>IS NULL/IS NOT NULL:</strong> Should hide the value input</div>
        </CardContent>
      </Card>
    </div>
  );
}