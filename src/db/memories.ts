import { Client } from 'ts-postgres';
import { Character } from './character';

export type Facts = Record<string, any> & {
  perspectiveOf?: Character,
  characters?: Character[],
  location?: string,
  dateTime?: string
}

export type Memory = {
  id: number,
  channelId: string,
  memory: string,
  facts?: Facts,
  createdAt: Date,
  updatedAt: Date
}

export default {
  init(): (c: Client) => Promise<void> {
    return async c => {
      await c.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id SERIAL PRIMARY KEY,
        channel_id TEXT NOT NULL,
        memory TEXT NOT NULL,
        facts JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
  },

  list(channelId: string): (c: Client) => Promise<Memory[]> {
    return async c => c
      .prepare<any>(`
        SELECT * FROM memories
        WHERE channel_id = $1
        order by created_at desc
      `)
      .then(p => p.execute([channelId]))
      .then((res) => res.rows.map(r => r.reify()))
  },

  get(characterId: number, channelId: string): (c: Client) => Promise<Memory> {
    return async c => c
      .prepare<any>(`
        SELECT * FROM memories
        WHERE facts->'perspectiveOf'->>'id' = $1 
        AND channel_id = $2
      `)
      .then(p => p.execute([characterId, channelId]).one())
  },

  create(channelId: string, memory: string, facts?: Facts): (c: Client) => Promise<number> {
    return async c => c
      .prepare(`
        INSERT INTO memories (channel_id, memory, facts)
        VALUES ($1, $2, $3)
        RETURNING id
      `).then(p => p.execute([channelId, memory, facts ?? {}]).one().then(r => r.id))
  },
}
