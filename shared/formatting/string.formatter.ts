export function getInitials(name: string) {
  const trimmed = name.trim();
  const parts = trimmed.split(/[\s_-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}
