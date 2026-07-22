/**
 * Benign TCP teardown noise from react-native-tcp-socket when we (or the TV)
 * close a connection mid-write / mid-ping. Not a real user-facing failure.
 */
export function isBenignSocketError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error &&
            typeof error === 'object' &&
            'message' in error &&
            (error as { message?: unknown }).message != null
          ? String((error as { message: unknown }).message)
          : String(error ?? '');

  return /socket is closed|closed socket|attempted to write to closed|cannot call write after/i.test(
    message,
  );
}
