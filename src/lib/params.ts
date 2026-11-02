export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function optionalParam(value: string | string[] | undefined): string | undefined {
  const text = param(value).trim();
  return text || undefined;
}
