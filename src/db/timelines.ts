import { Client } from 'ts-postgres';

export type Timeline = {
  id: number
  parent_id: number
  created_at: Date
}

export default {
  init(): (c: Client) => Promise<any> {
    return async c => c.query(`
      CREATE TABLE IF NOT EXISTS timelines (
        id BIGINT NOT NULL PRIMARY KEY,
        parent_id BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  create(channelId: number, parentId: number): (c: Client) => Promise<any> {
    return async c => c.prepare<Timeline>(`
    INSERT INTO timelines (id, parent_id)
    VALUES ($1, $2);
  `).then(p => p.execute([channelId, parentId]));
  },

  getParent(channelId: number): (c: Client) => Promise<number | null> {
    return async c => c
      .prepare<Timeline>(`
      SELECT parent_id FROM timelines
      WHERE id = $1
    `)
      .then(p => p.execute([channelId]).one())
      .then(r => r.parent_id)
  }
}
