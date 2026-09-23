export function normalizeMessage(message: string): string {
  const trimmed = message.trim();
  return trimmed.toLowerCase();
}

export function isEmptyMessage(message: string): boolean {
  return message.trim().length === 0;
}
