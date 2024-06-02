import { Client } from 'ts-postgres';

export type Memory = {
  id: number,
  channelId: string,
  memory: string,
  createdAt: Date,
  relatedId: string
}

export default {
  init(): (c: Client) => Promise<void> {
    return async c => {
      await c.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id SERIAL PRIMARY KEY,
        channel_id BIGINT NOT NULL,
        memory TEXT NOT NULL,
        related_id BIGINT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        spoken_by_id BIGINT NULL
      );
    `);
    }
  },

  list(channelIds: number | number[], relatedIds?: number | number[], spokenById?: number): (c: Client) => Promise<Memory[]> {
    const where: string[] = ['channel_id = ANY($1)'];
    const params: any[] = [
      Array.isArray(channelIds) ? channelIds : [channelIds]
    ];
    if (relatedIds) {
      where.push('related_id = ANY($2)');
      params.push(Array.isArray(relatedIds) ? relatedIds : [relatedIds])
    }
    if (spokenById) {
      where.push('spoken_by_id = $' + (where.length + 1))
      params.push(spokenById)
    }
    return async c => c
      .prepare<Memory>(`
        SELECT * FROM memories
        WHERE ${where.join(' AND ')}
        order by created_at desc
      `)
      .then(p => p.execute(params))
      .then((res) => res.rows.map(r => r.reify()))
  },

  get(relatedId: number, channelId: number): (c: Client) => Promise<Memory> {
    return async c => c
      .prepare<Memory>(`
        SELECT * FROM memories
        WHERE related_id = $1
        AND channel_id = $2
      `)
      .then(p => p.execute([relatedId, channelId]).one())
  },

  create(channelId: number, memory: string, relatedId?: number, spokenById?: number): (c: Client) => Promise<number> {
    return async c => c
      .prepare<Memory>(`
        INSERT INTO memories (channel_id, memory, related_id, spoken_by_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `).then(p => p.execute([channelId, memory, relatedId ?? null, spokenById ?? null])
        .one().then(r => r.id))
  },
}
