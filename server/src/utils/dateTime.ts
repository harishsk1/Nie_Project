type DateInput = Date | string | number | null | undefined;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "N/A";
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = MONTHS_SHORT[d.getMonth()];
  const yyyy = String(d.getFullYear());
  return `${dd}/${mmm}/${yyyy}`;
}

export function formatTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "N/A";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "N/A";
  return `${formatDate(d)} ${formatTime(d)}`;
}


