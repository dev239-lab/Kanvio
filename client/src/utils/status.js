export const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: '#16a34a' },
  { id: 'busy', label: 'Busy', color: '#dc2626' },
  { id: 'away', label: 'Away', color: '#f59e0b' },
  { id: 'meeting', label: 'In a meeting', color: '#7c3aed' },
  { id: 'leave', label: 'On leave', color: '#0ea5e9' },
];

export const CLEAR_OPTIONS = [
  { id: 'never', label: 'Never' },
  { id: '1h', label: '1 hour' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: '1 week' },
];

// When the status should switch back to Active (an ISO date), or null for never
export function clearTime(optionId) {
  const now = new Date();
  if (optionId === '1h') return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  if (optionId === 'week') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (optionId === 'today') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    // Late in the evening there may be almost nothing left of today, so keep at least a minute
    return new Date(Math.max(end.getTime(), now.getTime() + 60 * 1000)).toISOString();
  }
  return null;
}

// The status to show for a user: a status that has run out counts as Active
export function effectiveStatus(user) {
  const expired = user?.statusUntil && new Date(user.statusUntil) <= new Date();
  const found = STATUS_OPTIONS.find((s) => s.id === user?.status);
  if (expired || !found) {
    return { ...STATUS_OPTIONS[0], message: '' };
  }
  return { ...found, message: user.statusMessage || '' };
}