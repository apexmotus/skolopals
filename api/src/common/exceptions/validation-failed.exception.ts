import { BadRequestException } from '@nestjs/common';

export interface FieldError {
  field: string;
  messages: string[];
}

/** Carries the flattened, per-field shape `AllExceptionsFilter` puts under `errors` (generic spec §7.5). Thrown by the global `ValidationPipe`'s `exceptionFactory`. */
export class ValidationFailedException extends BadRequestException {
  constructor(public readonly errors: FieldError[]) {
    super('Validation failed.');
  }
}
