// Single error format for the whole API: { code: 'SNAKE_CASE', message: 'texto pt-BR' } (AGENTS.md).
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorBody = { code: string; message: string };

export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toBody(): ErrorBody {
    return { code: this.code, message: this.message };
  }
}

export const errors = {
  validation: (message = 'Dados inválidos.') => new AppError(400, 'VALIDATION_ERROR', message),
  unauthenticated: (message = 'Você precisa entrar para continuar.') => new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'Você não tem permissão para isso.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Não encontrado.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (code: string, message: string) => new AppError(409, code, message),
  rule: (code: string, message: string) => new AppError(422, code, message),
};
