import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, } from 'discord-interactions';
import { CreateFollowupMessage, GetChannel, GetChannelMessages, VerifyDiscordRequest } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { CommandType } from './commands';
import { createCharacter, getCharacter, psql } from './db';

const app = express();
const bot = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY!
}));


const PORT = process.env.PORT || 80;
const DEFAULT_SYS_MSG = 'you are narrating a story which involves multiple 1st person perspectives. always use the third person.';
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY!) }));

// health check
app.get('/', async function(_, res) {
  res.status(200).end();
});

// actual discord things
app.post('/interactions', async function(req, res) {
  const { type, data, channel, token } = req.body;

  switch (type) {
    case InteractionType.PING:
      return res.send({ type: InteractionResponseType.PONG });
    case InteractionType.APPLICATION_COMMAND:
      const { name } = data;
      switch (name.toLowerCase()) {
        case CommandType.Test:
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "testing"
            }
          });
        case CommandType.Prompt:
          const text = data.options[0]?.value;

          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          return generateCompletion(text, channel.id, data.name, token, DEFAULT_SYS_MSG, true);

        case CommandType.Continue:
          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          return generateCompletion('continue', channel.id, data.name, token, DEFAULT_SYS_MSG, true);

        case CommandType.SpawnCharacter:
          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          return psql()
            .then(createCharacter(data.options[0]?.value, channel.id, {
              traits: data.options[1]?.value,
              backstory: data.options[2]?.value
            }))
            .then(() =>
              CreateFollowupMessage(
                process.env.APP_ID!,
                token,
                `you have brought the character ${data.options[0]?.value} into the world`
              )
            );

        case CommandType.Ask:
          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          return psql()
            .then(getCharacter(data.options[0]?.value.toLowerCase(), channel.id))
            .then((c) =>
              generateCompletion(
                data.options[1]?.value,
                channel.id,
                data.name,
                token,
                `You are now the character ${c.name}.
                 Here are some details about them in JSON format: ${JSON.stringify(c.state)}
              `, false)
            );

        default:
          res.status(400).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Unknown command ${name}`
            }
          });
          break;
      }
    default:
      break;
  }

  return res.sendStatus(404).send('Unknown interaction type');
});


async function generateCompletion(prompt: string, channelId: string, name: string, token: string, systemMsg: string, includeContext: boolean): Promise<any> {
  const msg: CreateChatCompletionRequest = {
    model: 'gpt-3.5-turbo',
    messages: [
      { content: systemMsg, role: 'system' },
    ],
    max_tokens: 256,
    user: name
  };

  if (includeContext) {
    const sm = await GetChannelMessages(channelId);
    msg.messages.push({ content: sm.map((msg: any) => msg.content).join(" "), role: 'assistant' });
  }
  msg.messages.push({ content: prompt, role: 'user' });

  return bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string)
    .then((msg: string) => CreateFollowupMessage(process.env.APP_ID!, token, msg));
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
