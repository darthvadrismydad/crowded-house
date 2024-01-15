import { Client } from 'ts-postgres';

export async function psql(): Promise<Client> {
  const psql = new Client();
  await psql.connect();
  return psql;
}
