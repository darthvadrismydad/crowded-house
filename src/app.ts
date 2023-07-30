import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, } from 'discord-interactions';
import { CreateFollowupMessage, GetChannelMessages, VerifyDiscordRequest } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { CommandType } from './commands';
import { createCharacter, createDirective, getCharacter, getDirective, psql } from './db';

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
        case CommandType.Continue:
          // if its a prompt, there is a single option provided.
          // otherwise, we just want to say 'continue'
          const text = data.options ? data.options[0]?.value : 'continue';

          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          const directive = psql()
            .then(getDirective(channel.id))
            .catch(() => DEFAULT_SYS_MSG);

          return generateCompletion(text, channel.id, data.name, token, await directive);


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
                `${name} has brought ${data.options[0]?.value} into the chat`
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
                `You will reply as the character ${c.name}, who is represented by this JSON: ${JSON.stringify(c.state)}`)
            );
        case CommandType.CreateDirective:
          res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
          });

          return psql()
            .then(createDirective(channel.id, data.options[0]?.value))
            .then(() => CreateFollowupMessage(process.env.APP_ID!, token, `Created a new directive`));

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


async function generateCompletion(prompt: string, channelId: string, name: string, token: string, systemMsg: string): Promise<any> {

  const msgs: any[] = await GetChannelMessages(channelId);

  let story = '';
  let i = 0;
  // only keeping the most recent 2000 characters
  while (story.length < 2000 && i < msgs.length) {
    // the most recent messages are the last in the array,
    // so we need to order them in reverse and also stack em in reverse
    story = msgs[i].content + ' ' + story;
    i++;
  }

  const msg: CreateChatCompletionRequest = {
    model: 'gpt-3.5-turbo',
    messages: [
      { content: systemMsg, role: 'system' },
      {
        content: 'this is the story that has occurred so far: [' + story + ']',
        role: 'system'
      },
      { content: prompt, role: 'user', name: name }
    ],
    // TODO(luke): use threads to keep adding to the story over time?
    max_tokens: 256,
    user: name
  };

  return bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string)
    .then((msg: string) => CreateFollowupMessage(process.env.APP_ID!, token, msg));
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
