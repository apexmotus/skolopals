import type { ValidationError } from 'class-validator';
import type { FieldError } from '../exceptions/validation-failed.exception.js';

/** Flattens class-validator's `ValidationError[]` (which nests via `.children`) into one entry per field path, e.g. `guardian.email`. */
export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  const result: FieldError[] = [];

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      result.push({ field: path, messages: Object.values(error.constraints) });
    }
    if (error.children && error.children.length > 0) {
      result.push(...formatValidationErrors(error.children, path));
    }
  }

  return result;
}
