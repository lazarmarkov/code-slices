export const FORMAT_VERSION = 2;

export function normalizeMessage(message: string): string {
  const trimmed = message.trim();
  return trimmed.toLowerCase();
}

export function formatLabel(label: string): string {
  const normalized = label.trim();
  return `[${normalized}]`;
}

export function copiedGreeting(name: string): string {
  return `Hello ${name}`;
}

export function stableGreeting(name: string): string {
  return `Hello ${name}`;
}

export function uncoveredHelper(message: string): string {
  return message.trim().toUpperCase();
}
