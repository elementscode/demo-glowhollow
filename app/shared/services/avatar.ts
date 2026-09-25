/** A stable hue per name, so a member keeps their color everywhere. */
export function avatarColor(name: string): string {
  let hash = 0;

  for (let ch of name.toLowerCase()) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }

  return `background: oklch(0.56 0.13 ${hash % 360})`;
}

export function initial(name: string): string {
  return name.slice(0, 1).toUpperCase();
}
