import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, } from 'discord-interactions';
import { CreateFollowupMessage, VerifyDiscordRequest } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { CommandType, NpcCommands } from './commands';
import { psql } from './db';
import characterData, { Character } from './db/character';
import directiveData from './db/directive';
import memoryData from './db/memories';

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
  const user = req.body?.member?.user?.username ?? 'anon';
  console.log('got interaction', JSON.stringify(req.body));

  try {
    switch (type) {
      case InteractionType.PING:
        console.log('sending PONG');
        return res.send({ type: InteractionResponseType.PONG });
      case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE:
        switch (data.name.toLowerCase()) {
          case CommandType.Npcs:
            const subdata = data.options[0];
            switch (subdata.name) {
              case NpcCommands.Ask:
                const characters = await psql()
                  .then(characterData.list(channel.id));

                return res.send({
                  type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
                  data: {
                    choices: characters.map(({ name, id }) => ({ name, value: id }))
                  }
                });
            }
            return res.send({
              type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
              data: {
                choices: [{
                  name: 'test',
                  value: 'test'
                }]
              }
            });
        }
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

            const character = await psql().then(characterData.getByName(user, channel.id));

            return generateCompletion(
              text,
              channel.id,
              character,
              token
            );

          case CommandType.Npcs:
            const subdata = data.options[0];
            switch (subdata.name) {
              case NpcCommands.Create:
                res.send({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

                return psql()
                  .then(characterData.create(subdata.options[0]?.value, channel.id, {
                    traits: subdata.options[1]?.value,
                    backstory: subdata.options[2]?.value
                  }))
                  .then(() =>
                    CreateFollowupMessage(
                      process.env.APP_ID!,
                      token,
                      `${user} has brought ${subdata.options[0]?.value} into the chat`
                    )
                  );

              case NpcCommands.Ask:
                res.send({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

                return psql()
                  .then(async () =>
                    generateCompletion(
                      subdata.options[1]?.value,
                      channel.id,
                      await psql().then(characterData.get(subdata.options[0]?.value, channel.id)),
                      token,
                    )
                  );

              case NpcCommands.List:
                res.send({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

                return psql()
                  .then(characterData.list(channel.id))
                  .then((c) =>
                    CreateFollowupMessage(
                      process.env.APP_ID!,
                      token,
                      `Here are the characters in this channel: \n${c.join("\n")}`
                    )
                  );
              default: break;
            };

          case CommandType.CreateDirective:
            res.send({
              type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
            });

            return psql()
              .then(directiveData.create(channel.id, data.options[0]?.value))
              .then(() => CreateFollowupMessage(process.env.APP_ID!, token, `Created a new directive`));

          default:
            res.status(200).send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Unknown command ${JSON.stringify(data)}`
              }
            });
            break;
        }
      default:
        break;
    }

    return res.status(400).send('Unknown interaction type');
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});


async function generateCompletion(prompt: string, channelId: string, character: Character, token: string): Promise<any> {

  const client = await psql();
  const directive = await directiveData.get(channelId)(client).catch(() => DEFAULT_SYS_MSG);
  const memories = await memoryData.list(channelId)(client);
  const others = (await characterData.list(channelId)(client)).filter(c => c.id !== character.id);
  const story = memories.map(m => m.memory).join(' ');

  const msg: CreateChatCompletionRequest = {
    model: 'gpt-3.5-turbo-16k',
    messages: [
      {
        content: directive,
        role: 'system'
      },
      {
        content: 'the characters in the story are:' + JSON.stringify(others),
        role: 'assistant'
      },
      {
        content: 'what has happened so far: ' + story,
        role: 'assistant'
      },
      {
        content: prompt,
        role: 'user',
        name: prompt === 'continue' ? undefined : character.name.replaceAll('.', '')
      }
    ],
    user: character.name
  };

  const response = await bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string);

  await psql().then(memoryData.create(channelId, response, {
    perspectiveOf: character,
    dateTime: new Date().toISOString(),
  }));

  const words = response.split(' ');

  let size = 0;
  let fragment: string[] = [];
  for (let w of words) {
    size += w.length;
    if (size >= 256) {
      await CreateFollowupMessage(process.env.APP_ID!, token, fragment.join(' '));
      size = 0;
      fragment = [];
    }
    fragment.push(w);
  }
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
