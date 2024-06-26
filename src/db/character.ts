import { Client } from 'ts-postgres';

export type Character = {
  id: number
  name: string
  channel_id: number
  created_at: Date
  state: any
  is_npc: boolean
}

export default {
  init(): (c: Client) => Promise<any> {
    return async c => c.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        channel_id BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        state JSONB NOT NULL
        is_npc BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
  },

  create(name: string, channelId: number, state: any, isNpc: boolean = false): (c: Client) => Promise<any> {
    return async c => c.prepare<Character>(`
    INSERT INTO characters (name, channel_id, state, is_npc)
    VALUES ($1, $2, $3::jsonb, $4);
  `).then(p => p.execute([name, channelId, state, isNpc]));
  },

  get(id: number, channelId: number): (c: Client) => Promise<Character> {
    return async c => c
      .prepare<Character>(`
      SELECT * FROM characters
      WHERE id = $1
    `)
      .then(p => p.execute([id, channelId]).one())
  },

  getByName(name: string, channelId: number): (c: Client) => Promise<Character> {
    return async c => c
      .prepare<Character>(`
      SELECT * FROM characters
      WHERE name = $1
      AND channel_id = $2
    `)
      .then(p => p.execute([name, channelId]).one())
  },

  list(channelIds: number | number[]): (c: Client) => Promise<Character[]> {
    return async c => c
      .prepare<Character>(`
      SELECT * FROM characters
      WHERE channel_id = ANY($1)
    `)
      .then(p => p.execute([Array.isArray(channelIds) ? channelIds : [channelIds]]))
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

  appendState(id: number, key: string, value: string): (c: Client) => Promise<any> {
    return async c => c
      .prepare(`
        UPDATE characters
        SET state = jsonb_set(state, ARRAY[$1], $2)
        WHERE id = $3
      `)
      .then(p => p.execute([key, value, id]));
  }
}
