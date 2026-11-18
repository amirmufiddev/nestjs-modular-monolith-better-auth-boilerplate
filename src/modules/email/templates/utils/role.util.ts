export function humanizeRole(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return 'Member';
  return trimmed
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
