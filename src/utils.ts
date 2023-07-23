import { verifyKey } from 'discord-interactions';

export function VerifyDiscordRequest(clientKey: string) {
  return function(req: any, res: any, buf: any, encoding: any) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
    }
  };
}

export async function DiscordRequest(endpoint: string, options: any) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'CrowdedHouseBot',
    },
    ...options
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(JSON.stringify(data));
  }
  return res;
}

export async function InstallGlobalCommands(appId: string, commands: any[]) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  console.log(commands);

  try {
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

export async function GetChannelMessages(channelId: string): Promise<any> {
  const endpoint = `channels/${channelId}/messages?limit=100`;
  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    return await res.json();
  } catch (err) {
    console.error(err);
  }
}

export async function CreateFollowupMessage(appId: string, interactionToken: string, content: string) {
  const endpoint = `webhooks/${appId}/${interactionToken}`;
  try {
    const res = await DiscordRequest(endpoint, { method: 'POST', body: { content } });
    return await res.json();
  } catch (err) {
    console.error(err);
  }
}

export function getRandomEmoji() {
  const emojiList = ['😭', '😄', '😌', '🤓', '😎', '😤', '🤖', '😶‍🌫️', '🌏', '📸', '💿', '👋', '🌊', '✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
