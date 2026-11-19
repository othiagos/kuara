export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[];

/**
 * Lightweight class name merger avoiding external runtime dependencies.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const append = (item: ClassValue) => {
    if (!item && item !== 0) return;
    if (Array.isArray(item)) {
      for (const child of item) append(child);
      return;
    }
    if (typeof item === "string" || typeof item === "number") {
      const trimmed = String(item).trim();
      if (trimmed) classes.push(trimmed);
    }
  };

  for (const input of inputs) append(input);
  return classes.join(" ");
}
