const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const LONG_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', SHORT_DATE_OPTIONS);
}

export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', LONG_DATE_OPTIONS);
}
