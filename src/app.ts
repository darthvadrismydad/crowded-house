import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, } from 'discord-interactions';
import { CreateFollowupMessage, GetChannelMessages, VerifyDiscordRequest } from './utils';
import { Configuration, OpenAIApi } from 'openai';
import { CommandType } from './commands';

const app = express();
const bot = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY!
}));
const PORT = process.env.PORT || 80;
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY!) }));

app.get('/', async function(_, res) {
  res.status(200).end();
});

app.post('/interactions', async function(req, res) {
  const { type, data, channel, token } = req.body;

  switch (type) {
    case InteractionType.PING:
      return res.send({ type: InteractionResponseType.PONG });
    case InteractionType.APPLICATION_COMMAND:
      const { name } = data;
      switch (name.toLowerCase()) {
        case CommandType.Test:
          const msg = (await GetChannelMessages(channel.id))[0].content;
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: JSON.stringify(msg)
            }
          });
        case CommandType.Prompt:
          const text = data.options[0]?.value;

          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          // actual response
          GetChannelMessages(channel.id)
            .then(m => m.map((msg: any) => msg.content).join(" "))
            .then((storySoFar) => bot.createChatCompletion({
              model: 'gpt-3.5-turbo',
              messages: [
                { content: 'you are narrating a story which involves multiple 1st person perspectives. always use the third person.', role: 'system' },
                { content: storySoFar, role: 'assistant' },
                { content: text, role: 'user' }
              ],
              max_tokens: 256,
              user: data.name
            }))
            .then(r => r.data?.choices[0]?.message?.content as string)
            .then((msg: string) => CreateFollowupMessage(process.env.APP_ID!, token, msg));

        case CommandType.Continue:
          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          // actual response
          GetChannelMessages(channel.id)
            .then(m => m.map((msg: any) => msg.content).join(" "))
            .then((storySoFar) => bot.createChatCompletion({
              model: 'gpt-3.5-turbo',
              messages: [
                { content: 'you are narrating a story which involves multiple 1st person perspectives. always use the third person.', role: 'system' },
                { content: storySoFar, role: 'assistant' },
                { content: 'continue', role: 'user' }
              ],
              max_tokens: 256,
              user: data.name
            }))
            .then(r => r.data?.choices[0]?.message?.content as string)
            .then((msg: string) => CreateFollowupMessage(process.env.APP_ID!, token, msg));
        default:
          break;
      }
    default:
      break;
  }

  return res.sendStatus(404).send('Unknown interaction type');
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
