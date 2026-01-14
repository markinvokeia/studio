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

    // Extract base variable and offset
    const match = variable.match(/^((TODAY|YESTERDAY|TOMORROW|WEEK_START|WEEK_END|MONTH_START|MONTH_END|YEAR_START|YEAR_END))([+-]\d+)?$/);
    if (!match) {
      // If it's a regular date string, return as is
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(variable)) {
        return new Date(variable);
      }
      throw new Error(`Invalid date variable: ${variable}`);
    }

    const base = match[1];
    const offsetStr = match[3];
    const offset = offsetStr ? parseInt(offsetStr) : 0;

    let baseDate: Date;

    switch (base) {
      case 'TODAY':
        baseDate = new Date(today);
        break;
      case 'YESTERDAY':
      case 'TODAY-1':
        baseDate = new Date(today);
        baseDate.setDate(baseDate.getDate() - 1);
        break;
      case 'TOMORROW':
      case 'TODAY+1':
        baseDate = new Date(today);
        baseDate.setDate(baseDate.getDate() + 1);
        break;
      case 'WEEK_START':
        baseDate = new Date(today);
        const day = baseDate.getDay();
        const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1); // Monday of current week
        baseDate.setDate(diff);
        break;
      case 'WEEK_END':
        baseDate = new Date(today);
        const dayEnd = baseDate.getDay();
        const diffEnd = baseDate.getDate() - dayEnd + (dayEnd === 0 ? 0 : 7); // Sunday of current week
        baseDate.setDate(diffEnd);
        break;
      case 'MONTH_START':
        baseDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'MONTH_END':
        baseDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'YEAR_START':
        baseDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'YEAR_END':
        baseDate = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        throw new Error(`Invalid date variable: ${variable}`);
    }

    // Apply offset if any
    if (offset !== 0) {
      baseDate.setDate(baseDate.getDate() + offset);
    }

    return baseDate;
  },

  /**
   * Checks if a value is a valid date variable
   */
  isValidDateVariable(value: string): boolean {
    const dateVariableRegex = /^((TODAY|YESTERDAY|TOMORROW|WEEK_START|WEEK_END|MONTH_START|MONTH_END|YEAR_START|YEAR_END)([+-]\d+)?|\d{4}-\d{2}-\d{2})$/;
    return dateVariableRegex.test(value);
  }
};

/**
 * Utility function to replace date variables in SQL conditions
 */
export function replaceDateVariablesInCondition(condition: string): string {
  const variableRegex = /\b((TODAY|YESTERDAY|TOMORROW|WEEK_START|WEEK_END|MONTH_START|MONTH_END|YEAR_START|YEAR_END)([+-]\d+)?)\b/g;
  
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