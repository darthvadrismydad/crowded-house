import 'dotenv/config';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { CreateFollowupMessage, VerifyDiscordRequest } from './utils';
import { Configuration, OpenAIApi } from 'openai';
import { CommandType, NpcCommands } from './commands';
import { psql } from './db';
import characterData from './db/character';
import directiveData from './db/directive';
import Bun from 'bun';
import { generateCompletion } from './generate';

const PORT = process.env.PORT || 80;

const verify = VerifyDiscordRequest(process.env.PUBLIC_KEY!);
const reply = (obj: Record<string, any> | null, status?: number) => new Response(JSON.stringify(obj), { 
  status,
  headers: {
    'Content-Type': 'application/json'
  }
});

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/') {
      return new Response();
    } else if (url.pathname === '/interactions') {

      const body = await req.text();

      if (!verify(req, body)) {
        return new Response('Bad request signature', { status: 401 });
      }

      const { member, type, data, channel, token } = JSON.parse(body);
      const user = member?.user?.username ?? 'anon';
      const db = await psql();

      try {
        switch (type) {
          case InteractionType.PING:
            return reply(({ type: InteractionResponseType.PONG }));
          case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE:
            switch (data.name.toLowerCase()) {
              case CommandType.Npcs:
                const subdata = data.options[0];
                switch (subdata.name) {
                  case NpcCommands.Ask:
                    const characters = await psql()
                      .then(characterData.list(channel.id));

                    return reply({
                      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
                      data: {
                        choices: characters.map(({ name, id }) => ({ name, value: id }))
                      }
                    });
                }
                return reply({
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
                return reply({
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

                generateCompletion(
                  db,
                  text,
                  channel.id,
                  name,
                  token
                );

                return reply({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

              case CommandType.Npcs:
                const subdata = data.options[0];
                switch (subdata.name) {
                  case NpcCommands.Create:
                    psql()
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
                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  case NpcCommands.Ask:
                    psql()
                      .then(async () =>
                        generateCompletion(
                          db,
                          subdata.options[1]?.value,
                          channel.id,
                          name,
                          token,
                        )
                      );

                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  case NpcCommands.List:
                    psql()
                      .then(characterData.list(channel.id))
                      .then((c) =>
                        CreateFollowupMessage(
                          process.env.APP_ID!,
                          token,
                          `Here are the characters in this channel: \n${c.map(c => c.name).join("\n")}`
                        )
                      );

                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  default: break;
                };

              case CommandType.CreateDirective:
                psql()
                  .then(directiveData.create(channel.id, data.options[0]?.value))
                  .then(() => CreateFollowupMessage(process.env.APP_ID!, token, `Created a new directive`));

                return reply({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

              default:
                return reply({
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: `Unknown command ${JSON.stringify(data)}`
                  }
                });
            }
          default:
            break;
        }

        return reply({ msg: 'Unknown interaction type' }, 400);
      } catch (err) {
        console.error(err);
        return reply(null, 500);
      }
    }

    return new Response('not found', { status: 404 });
  }
});

console.log(`Listening on port ${server.port}`);

