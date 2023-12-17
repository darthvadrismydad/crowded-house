import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType, } from 'discord-interactions';
import { CreateFollowupMessage, GetChannelMessages, VerifyDiscordRequest } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { CommandType, NpcCommands } from './commands';
import { createCharacter, createDirective, getCharacter, getDirective, listCharacters, psql } from './db';

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
  console.log('got interaction', type, data, channel, token, user);

  try {
    switch (type) {
      case InteractionType.PING:
        return res.send({ type: InteractionResponseType.PONG });
      case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE:
        switch (data.name.toLowerCase()) {
          case CommandType.Npcs:
            const subdata = data.options[0];
            switch (subdata.name) {
              case NpcCommands.Ask:
                const characters = await psql()
                  .then(listCharacters(channel.id))
                  .catch(() => [{ name: 'failed', value: 'F' }]);
                return res.send({
                  type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
                  data: {
                    choices: characters.map(({ name }) => ({ name, value: name }))
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

            const directive = await psql()
              .then(getDirective(channel.id))
              .catch(() => DEFAULT_SYS_MSG);

            const characters = await psql().then(listCharacters(channel.id));

            return generateCompletion(
              text, 
              channel.id, 
              user, 
              token, 
              directive + '\n' + characters.map(c => `The character ${c.name} is represented by this JSON: ${JSON.stringify(c.state)}`).join('\n'));

          case CommandType.Npcs:
            const subdata = data.options[0];
            switch (subdata.name) {
              case NpcCommands.Create:
                res.send({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

                return psql()
                  .then(createCharacter(subdata.options[0]?.value, channel.id, {
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
                  .then(async client => {
                    const npc = await getCharacter(subdata.options[0]?.value, channel.id)(client);
                    const others = await listCharacters(channel.id)(client);
                    return { npc, others };
                  })
                  .then(({ npc, others }) =>
                    generateCompletion(
                      subdata.options[1]?.value,
                      channel.id,
                      user,
                      token,
                      `The reply format is [NAME]: [REPLY]. 
                     You will reply as the character ${npc.name}, who is represented by this JSON: ${JSON.stringify(npc.state)}. 
                     The other characters in this channel are: ${others}`)
                  );

              case NpcCommands.List:
                res.send({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

                return psql()
                  .then(listCharacters(channel.id))
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
              .then(createDirective(channel.id, data.options[0]?.value))
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

    return res.sendStatus(404).send('Unknown interaction type');
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
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
    model: 'gpt-3.5-turbo-16k',
    messages: [
      { content: systemMsg, role: 'system' },
      {
        content: 'this is the story that has occurred so far: [' + story + ']',
        role: 'system'
      },
      { content: prompt, role: 'user', name: name.replaceAll('.', '') }
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
