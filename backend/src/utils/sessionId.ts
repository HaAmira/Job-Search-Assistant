const SESSION_ID_PATTERN = /^sess_[A-Za-z0-9_-]{43}$/;

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

export function assertValidSessionId(value: unknown): asserts value is string {
  if (!isValidSessionId(value)) {
    const error = new Error('Invalid session ID');
    Object.assign(error, { statusCode: 400 });
    throw error;
  }
}
