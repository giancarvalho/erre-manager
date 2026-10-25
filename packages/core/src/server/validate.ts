import { validator } from 'hono/validator';
import type { z, ZodType } from 'zod';

type Target = 'json' | 'query' | 'param';

/**
 * Zod validation for body, query or params. Invalid input throws a ZodError, which the error handler
 * turns into 400 VALIDATION_ERROR with the first message (pt-BR). Read the result with c.req.valid(target).
 */
export function validate<T extends Target, S extends ZodType>(target: T, schema: S) {
  return validator(target, (value) => schema.parse(value) as z.output<S>);
}
