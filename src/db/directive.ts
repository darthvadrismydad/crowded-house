import { Client } from 'ts-postgres';

export default {
  init(): (c: Client) => Promise<any> {
    return async c => c.query(`
      CREATE TABLE IF NOT EXISTS directives (
        id SERIAL PRIMARY KEY,
        channel_id TEXT NOT NULL,
        directive TEXT NOT NULL
      );
    `);
  },

  get(channelId: string): (c: Client) => Promise<string> {
    return async c => c
      .prepare(`
      SELECT directive
      FROM directives
      WHERE channel_id = $1
    `)
      .then(p => p.execute([channelId]))
      .then(res => res.rows.map(_ => _.get('directive')).join('\n'));
  },

  create(channelId: string, directive: string): (c: Client) => Promise<any> {
    return async c => c
      .prepare(`
      INSERT INTO directives (channel_id, directive)
      VALUES ($1, $2)
    `)
      .then(p => p.execute([channelId, directive]));
  }
}
