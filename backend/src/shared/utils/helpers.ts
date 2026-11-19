export function toNumberId(val: string | number | bigint): number {
  if (typeof val === 'string') return Number(val);
  if (typeof val === 'bigint') return Number(val);
  return val;
}
