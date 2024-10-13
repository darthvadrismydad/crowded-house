import dotenv from 'dotenv';
import os from 'os';
import { GatewayEvent } from './gateway.types';
import { generateCompletion } from './generate';
import { psql } from './db';
import { CreateMessage, splitUpFollowup } from './utils';
import character from './db/character';
dotenv.config();

export async function connectToGateway(onMessage: (msg: GatewayEvent) => Promise<GatewayEvent | void>) {
    const gateway = new WebSocket('wss://gateway.discord.gg');

    function eventOnce(eventName: Parameters<typeof gateway.addEventListener>[0]) {
        return new Promise(res => gateway.addEventListener(eventName, res, { once: true }));
    }

    function waitFor(millis: number) {
        return new Promise(res => setTimeout(res, millis));
    }

    let hearbeatInterval = 1000;

    gateway.onmessage = async msg => {
        const data = JSON.parse(msg.data as string);
        switch (data.op) {
            // hello
            case 10: {
                hearbeatInterval = data.d.heartbeat_interval;
                gateway.send(JSON.stringify({
                    op: 1,
                    d: null
                }));
                break;
            }
            // heartbeat
            case 11:
                await waitFor(hearbeatInterval * Math.random());
                gateway.send(JSON.stringify({
                    op: 1,
                    d: null
                }));
                break;
            // all app-level (non-protocol) events happen here
            default:
                const result = await onMessage(data);
                if (result) {
                    gateway.send(JSON.stringify(result));
                }
                break;
        }
    };

    await eventOnce('open');

    gateway.send(JSON.stringify({
        op: 2,
        d: {
            token: process.env.DISCORD_TOKEN,
            properties: {
                os: os.platform(),
                browser: 'crowded-house-bot',
                device: 'dev-crowded-house-bot'
            },
            compress: false,
            presence: {},
            intents: (1 << 9) + (1 << 15)
        }
    }));
}

connectToGateway(async msg => {
    if(msg.op === 0 && msg.t === "MESSAGE_CREATE") {
        const author = msg.d.author;

        if(author.bot) return;

        const prompt = msg.d.content;
        const channel = msg.d.channel_id as any;

        const chars = await psql(character.list(channel))
        const involved = chars.filter(c => prompt.includes(c.name));

        const response = await psql(generateCompletion(prompt, channel, msg.d.author.username));
        await splitUpFollowup(response, CreateMessage.bind(null, channel));
    }
});
