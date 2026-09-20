export const FORMAT_VERSION = 1;

export function normalizeMessage(message: string): string {
  const trimmed = message.trim();
  return trimmed;
}

export function legacySlug(message: string): string {
  return message.trim().replaceAll(' ', '-');
}

export function formatLabel(label: string): string {
  return `[${label.trim()}]`;
}

export function stableGreeting(name: string): string {
  return `Hello ${name}`;
}

export function uncoveredHelper(message: string): string {
  return message.trim();
}
