const pad = (n: number) => String(n).padStart(2, "0");
/** ISO timestamp -> value for <input type="datetime-local"> in the user's own time zone. */
export function toLocalInput(iso?: unknown) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null when empty. */
export function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export const formatDate = (iso: unknown) =>
  iso ? new Date(String(iso)).toLocaleDateString() : "—";
export const formatDateTime = (iso: unknown) =>
  iso ? new Date(String(iso)).toLocaleString() : "—";
