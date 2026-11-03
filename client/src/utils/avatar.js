const COLORS = ['#4f46e5', '#0d9488', '#d97706', '#db2777', '#2563eb', '#7c3aed'];

export function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function avatarColor(name = '') {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return COLORS[sum % COLORS.length];
}