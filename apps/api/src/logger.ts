// Structured logs without personal data: auth headers, cookies, tokens and e-mails are redacted.
import pino, { type Logger, type LoggerOptions } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.authorization',
  '*.cookie',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.password',
  '*.email',
  'email',
  'token',
];

export function createLogger(options: LoggerOptions = {}, destination?: pino.DestinationStream): Logger {
  const opts: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: null,
    ...options,
  };
  return destination ? pino(opts, destination) : pino(opts);
}
