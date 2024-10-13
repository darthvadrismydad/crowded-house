import { Client } from 'ts-postgres';

export async function psql<T>(fn: (conn: Client) => Promise<T>): Promise<T> {
  const psql = new Client();
  await psql.connect();
  const result = await fn(psql);
  await psql.end();
  return result;
}
