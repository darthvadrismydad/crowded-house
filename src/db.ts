import { Client, DataType } from 'ts-postgres';

export interface Character {
  id: number;
  name: string;
  channelId: string;
  createdAt: Date;
  state: any;
}

export async function psql(): Promise<Client> {
  const psql = new Client();
  await psql.connect();
  return psql;
}

export async function init() {
  return (await psql()).query(`
    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      state TEXT NOT NULL
    );
  `);
}

export function createCharacter(name: string, channelId: string, state: any): (c: Client) => Promise<any> {
  return async c => c.prepare(`
    INSERT INTO characters (name, channel_id, state)
    VALUES ('$1', '$2', '$3');
  `).then(p => p.execute([name, channelId, JSON.stringify(state)]));
}

export function getCharacter(name: string, channelId: string): (c: Client) => Promise<Character> {
  return async c => c
    .prepare(`
      SELECT * FROM characters
      WHERE LOWER(name) = LOWER($1)
      AND channel_id = $2
    `)
    .then(p => p.execute([name, channelId]).one())
    .then((res) => ({
      id: res.get('id')!,
      name: res.get('name')!,
      channelId: res.get('channel_id')!,
      createdAt: res.get('created_at')!,
      state: JSON.parse(res.get('state')!.toString())
    } as Character));
}

export function updateCharacter(id: number, state: any): (c: Client) => Promise<any> {
  return async c => c
    .prepare(`
        UPDATE characters
        SET state = '$1'
        WHERE id = '$2'
      `)
    .then(p => p.execute([state, id]));
}

export function getDirective(channelId: string): (c: Client) => Promise<string> {
  return async c => c
    .prepare(`
      SELECT * 
      FROM directives
      WHERE channel_id = $1
    `)
    .then(p => p.execute([channelId]).one())
    .then(res => res.get('directive')!.toString());
}

export function createDirective(channelId: string, directive: string): (c: Client) => Promise<any> {
  return async c => c
    .prepare(`
      INSERT INTO directives (channel_id, directive)
      VALUES ($1, $2)
    `)
    .then(p => p.execute([channelId, directive]));
}
