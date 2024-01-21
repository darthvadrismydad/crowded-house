import { Client } from 'ts-postgres';

export interface Character {
  id: number;
  name: string;
  channelId: string;
  createdAt: Date;
  state: any;
}

export default {
  init(): (c: Client) => Promise<any> {
    return async c => c.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        state JSONB NOT NULL
      );
    `);
  },

  create(name: string, channelId: string, state: any): (c: Client) => Promise<any> {
    return async c => c.prepare<Character>(`
    INSERT INTO characters (name, channel_id, state)
    VALUES ($1, $2, $3);
  `).then(p => p.execute([name, channelId, JSON.stringify(state)]));
  },

  get(id: number, channelId: string): (c: Client) => Promise<Character> {
    return async c => c
      .prepare<Character>(`
      SELECT * FROM characters
      WHERE id = $1
    `)
      .then(p => p.execute([id, channelId]).one())
  },

  getByName(name: string, channelId: string): (c: Client) => Promise<Character> {
    return async c => c
      .prepare<Character>(`
      SELECT * FROM characters
      WHERE name = $1
      AND channel_id = $2
    `)
      .then(p => p.execute([name, channelId]).one())
  },

  list(channelId: string): (c: Client) => Promise<Character[]> {
    return async c => c
      .prepare<Character>(`
      SELECT * FROM characters
      WHERE channel_id = $1
    `)
      .then(p => p.execute([channelId]))
      .then((res) => res.rows.map(r => r.reify()))
  },

  update(id: number, state: any): (c: Client) => Promise<any> {
    return async c => c
      .prepare(`
        UPDATE characters
        SET state = $1
        WHERE id = $2
      `)
      .then(p => p.execute([state, id]));
  },

  appendState(id: number, key: string, value: any): (c: Client) => Promise<any> {
    return async c => c
      .prepare(`
        UPDATE characters
        SET state->>$2 = $3
        WHERE id = $1
      `)
      .then(p => p.execute([id, key, value]));
  }
}
