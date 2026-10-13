function localDay(value: string | Date): Date {
  if (typeof value === 'string') {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function daysFromToday(date: string, referenceDate = new Date()): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((localDay(date).getTime() - localDay(referenceDate).getTime()) / millisecondsPerDay);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDay(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}
