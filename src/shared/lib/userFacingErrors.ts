export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) return fallback;

  const raw = error.message.trim();
  const parts = raw.split("Error: ");
  const message = (parts[parts.length - 1] || raw).trim();

  if (!message) return fallback;

  if (
    /UNIQUE constraint failed|FOREIGN KEY constraint failed|NOT NULL constraint failed|CHECK constraint failed|SQLITE_CONSTRAINT|SqliteError/i.test(
      message,
    )
  ) {
    return fallback;
  }

  return message;
}
