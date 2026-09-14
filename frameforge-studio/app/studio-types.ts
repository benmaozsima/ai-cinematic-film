export type Row = Record<string, any>;
export type Film = Row & {
  id: string;
  title: string;
  scenes: Row[];
  shots: Row[];
  entities: Row[];
  versions: Row[];
  tracks: Row[];
};
export async function api(
  path: string,
  body?: unknown,
  method?: string,
): Promise<any> {
  const response = await fetch('/api' + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
export const media = (v: Row) => '/api/media/' + v.localPath;
export const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(n % 60)
    .toString()
    .padStart(2, '0')}`;
