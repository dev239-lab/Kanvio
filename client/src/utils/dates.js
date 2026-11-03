// Local calendar day as YYYY-MM-DD, so "today" follows the user's clock
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Label and color tone for a due date chip
export function dueInfo(dueDate) {
  if (!dueDate) return null;
  const todayKey = dayKey(new Date());
  const key = dayKey(dueDate);
  if (key < todayKey) return { label: 'Overdue', tone: 'late' };
  if (key === todayKey) return { label: 'Today', tone: 'today' };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === dayKey(tomorrow)) return { label: 'Tomorrow', tone: 'soon' };
  const label = new Date(dueDate).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return { label, tone: 'later' };
}