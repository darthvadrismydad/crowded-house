export type GatewayEvent =
  MessageCreateEvent
  | MessageDeleteEvent
  ;

export type User = {
  id: string,
  username: string,
  bot: boolean
};

export type Member = {
  user?: User,
  nick?: string
};

export type Embed = {
  title?: string,
  type?: string,
  url?: string,
  image?: {
    url: string,
    height: number,
    width: number
  }
};

export type Attachment = {
  id: string,
  filename: string,
  description: string,
  content_type: string,
  size: number,
  url: string,
  height: number,
  width: number
};

export type MessageCreateEvent = {
  op: 0,
  t: "MESSAGE_CREATE",
  d: {
    type: number,
    tts?: boolean,
    timestamp: string,
    pinned?: boolean,
    mentions: User[],
    mention_everyone?: boolean,
    member: Member,
    id: string,
    embeds: Embed[],
    edited_timestamp: string,
    content: string,
    channel_id: string,
    author: User,
    attachments: Attachment[],
    guild_id: string,
  }
}

export type MessageDeleteEvent = {
  op: 0,
  t: "MESSAGE_DELETE",
  d: {
    id: string,
    channel_id: string,
    guild_id: string
  }
};
