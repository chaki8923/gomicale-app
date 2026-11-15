import { parseJobErrorCode } from './job-errors'

const validationCodes = [
  'INVALID_DRAFT', 'INVALID_EVENTS', 'INVALID_CALENDAR', 'INVALID_EVENT',
  'INVALID_COLOR', 'INVALID_TIME', 'INVALID_TIMEZONE', 'DUPLICATE_EVENTS', 'EMPTY_SELECTION',
] as const

const requestCodes = [
  ...validationCodes,
  'ACCOUNT_DELETING', 'ALREADY_STARTED', 'EDIT_CONFLICT', 'FORBIDDEN', 'IMPORT_LOCKED',
  'IMPORT_NOT_READY', 'INVALID_INSTRUCTION', 'INVALID_JOB', 'INVALID_JSON',
  'INVALID_REGISTRATION_MODE', 'NOT_FOUND', 'REQUEST_TOO_LARGE', 'UNAUTHORIZED',
  'LIMIT_EXCEEDED', 'REQUEST_FAILED',
] as const

export function isImportValidationCode(value: string): boolean {
  return (validationCodes as readonly string[]).includes(value)
}

export function importRequestErrorCode(value: unknown) {
  if (typeof value === 'string' && (requestCodes as readonly string[]).includes(value)) {
    return value as typeof requestCodes[number]
  }
  return parseJobErrorCode(value) ?? 'REQUEST_FAILED'
}

export class ImportRequestError extends Error {
  readonly code: ReturnType<typeof importRequestErrorCode>
  constructor(value: unknown) {
    const code = importRequestErrorCode(value)
    super(code)
    this.code = code
  }
}
