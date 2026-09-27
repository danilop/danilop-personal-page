/** Preserve native error identity and errno fields; normalise non-Error rejections. */
export function asError(value: unknown): NodeJS.ErrnoException {
  return value instanceof Error
    ? value
    : new Error(String(value), { cause: value });
}
