export interface DateVariableProcessor {
  processDateVariable: (variable: string) => string;
  resolveDateVariable: (variable: string) => Date;
  isValidDateVariable: (value: string) => boolean;
}

export const dateVariableProcessor: DateVariableProcessor = {
  /**
   * Converts date variable to SQL-compatible date string
   */
  processDateVariable(variable: string): string {
    const date = this.resolveDateVariable(variable);
    return date.toISOString().split('T')[0];
  },

  /**
   * Resolves date variable to actual Date object
   */
  resolveDateVariable(variable: string): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day

    // Handle TODAY with +/- days
    const todayMatch = variable.match(/^TODAY([+-]\d+)?$/);
    if (todayMatch) {
      const daysOffset = todayMatch[1] ? parseInt(todayMatch[1]) : 0;
      const result = new Date(today);
      result.setDate(result.getDate() + daysOffset);
      return result;
    }

    // Handle YESTERDAY
    if (variable === 'YESTERDAY' || variable === 'TODAY-1') {
      const result = new Date(today);
      result.setDate(result.getDate() - 1);
      return result;
    }

    // Handle TOMORROW
    if (variable === 'TOMORROW' || variable === 'TODAY+1') {
      const result = new Date(today);
      result.setDate(result.getDate() + 1);
      return result;
    }

    // Handle WEEK_START (Monday of current week)
    if (variable === 'WEEK_START') {
      const result = new Date(today);
      const day = result.getDay();
      const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
      result.setDate(diff);
      return result;
    }

    // Handle WEEK_END (Sunday of current week)
    if (variable === 'WEEK_END') {
      const result = new Date(today);
      const day = result.getDay();
      const diff = result.getDate() - day + (day === 0 ? 0 : 7); // Adjust for Sunday
      result.setDate(diff);
      return result;
    }

    // Handle MONTH_START (first day of current month)
    if (variable === 'MONTH_START') {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }

    // Handle MONTH_END (last day of current month)
    if (variable === 'MONTH_END') {
      return new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Handle YEAR_START (January 1st of current year)
    if (variable === 'YEAR_START') {
      return new Date(today.getFullYear(), 0, 1);
    }

    // Handle YEAR_END (December 31st of current year)
    if (variable === 'YEAR_END') {
      return new Date(today.getFullYear(), 11, 31);
    }

    // If it's a regular date string, return as is
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(variable)) {
      return new Date(variable);
    }

    // If variable is not recognized, throw error
    throw new Error(`Invalid date variable: ${variable}`);
  },

  /**
   * Checks if a value is a valid date variable
   */
  isValidDateVariable(value: string): boolean {
    const dateVariableRegex = /^(TODAY([+-]\d+)?|YESTERDAY|TOMORROW|WEEK_START|WEEK_END|MONTH_START|MONTH_END|YEAR_START|YEAR_END|\d{4}-\d{2}-\d{2})$/;
    return dateVariableRegex.test(value);
  }
};

/**
 * Utility function to replace date variables in SQL conditions
 */
export function replaceDateVariablesInCondition(condition: string): string {
  const variableRegex = /\b(TODAY([+-]\d+)?|YESTERDAY|TOMORROW|WEEK_START|WEEK_END|MONTH_START|MONTH_END|YEAR_START|YEAR_END)\b/g;
  
  return condition.replace(variableRegex, (match) => {
    try {
      return `'${dateVariableProcessor.processDateVariable(match)}'`;
    } catch (error) {
      console.error(`Error processing date variable ${match}:`, error);
      return `'${match}'`;
    }
  });
}

/**
 * Utility function to parse complex date expressions (for IN, NOT IN, BETWEEN)
 */
export function parseDateExpression(expression: string): string[] {
  // Handle cases like "TODAY AND TODAY+7" or "2024-01-01, TODAY, WEEK_START"
  const parts = expression.split(/,|\s+AND\s+/i).map(part => part.trim()).filter(part => part);
  
  return parts.map(part => {
    if (dateVariableProcessor.isValidDateVariable(part)) {
      try {
        return dateVariableProcessor.processDateVariable(part);
      } catch (error) {
        console.error(`Error processing date part ${part}:`, error);
        return part;
      }
    }
    return part;
  });
}