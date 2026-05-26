// Format an ISO date-only string (YYYY-MM-DD, or full ISO with time) to display string (DD/MM/YYYY).
// Never goes through `new Date(...)` — that parses YYYY-MM-DD as UTC midnight which shifts in local
// timezones. Date-only DB columns should be displayed exactly as stored.
export const formatLocalDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const datePart = String(dateStr).split('T')[0];
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
};

// Parse a date-only string (YYYY-MM-DD) into a Date at LOCAL midnight, so date arithmetic
// (slider boundaries, diff in days) returns the same date the user sees.
// `new Date("2026-03-01")` parses as UTC midnight which shifts in negative TZ offsets.
export const parseLocalDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const datePart = String(dateStr).split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

// Format a Date object into "YYYY-MM-DD" using LOCAL components.
// Never use `.toISOString().split('T')[0]` — that uses UTC and shifts the day in negative TZ.
export const formatLocalISO = (date: Date | null | undefined): string => {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
