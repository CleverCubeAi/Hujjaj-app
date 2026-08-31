export function formatMad(value: number | string | null | undefined, suffix = 'MAD'): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = safe.toLocaleString('fr-MA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${formatted} ${suffix}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function statusColor(status?: string) {
  switch (status) {
    case 'paid':
    case 'confirmed':
      return '#2E7D5B';
    case 'draft':
    case 'pending':
      return '#C9842A';
    case 'cancelled':
    case 'expired':
      return '#C4473A';
    default:
      return '#5C6B73';
  }
}
