/**
 * Application-level error class.
 *
 * Use this instead of attaching `.code` to plain Error objects via
 * the NodeJS.ErrnoException hack. Provides a structured error with
 * an HTTP status code, an error code string, and a message.
 *
 * Example:
 *   throw new AppError('COMPONENT_NOT_FOUND', 'Composant introuvable', 404);
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  /** Returns a JSON-safe error payload for API responses. */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}
