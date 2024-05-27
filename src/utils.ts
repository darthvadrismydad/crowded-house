import { verifyKey } from 'discord-interactions';
import { Commands } from './commands';

export function VerifyDiscordRequest(clientKey: string) {
  return function(req: Request, buf: string) {
    const signature = req.headers.get('X-Signature-Ed25519');
    const timestamp = req.headers.get('X-Signature-Timestamp');

    return verifyKey(buf, signature!, timestamp!, clientKey);
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

export async function InstallGlobalCommands() {
  const appId = process.env.APP_ID!;
  const commands = Array.from(Commands.entries()).map(([name, value]) => ({ name, ...value }));
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
  const endpoint = `channels/${channelId}/messages`;
  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    return await res.json();
  } catch (err) {
    console.error(err);
  }
}

export async function GetChannel(channelId: string): Promise<any> {
  const endpoint = `channels/${channelId}`;
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
