export class PersistenceError extends Error {
  constructor(
    public readonly code: 'INVALID_DATA' | 'UNSUPPORTED_RULES' | 'UNSUPPORTED_SCHEMA' | 'MISSING_CHECKPOINT',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PersistenceError';
  }
}
