import 'dotenv/config';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { CreateChannel, CreateFollowupMessage, VerifyDiscordRequest, splitUpFollowup } from './utils';
import { CommandType, NpcCommands } from './commands';
import { psql } from './db';
import characterData from './db/character';
import directiveData from './db/directive';
import timelineData from './db/timelines';
import Bun from 'bun';
import { generateAskResponse, generateCharacters, generateCompletion } from './generate';

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
                  case NpcCommands.Mold:
                    const opts = subdata.options;
                    const characters = await characterData.list(channel.id)(db);

                    return reply({
                      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
                      data: {
                        choices: characters.filter(c =>
                          c.is_npc &&
                          (!opts?.[0].value?.trim()
                            || c.name.toLowerCase().includes(opts[0].value.toLowerCase()))
                        ).map(({ name, id }) => ({
                          name,
                          value: id.toString()
                        }))
                      }
                    });
                }
              default:
                return reply({
                  type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
                  data: {
                    choices: []
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
                  user
                ).then(response => {
                  splitUpFollowup(response, CreateFollowupMessage.bind(null, token, process.env.APP_ID!));
                });

                return reply({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                });

              case CommandType.Npcs:
                const subdata = data.options[0];
                switch (subdata.name) {
                  case NpcCommands.AutoGenerate:
                    generateCharacters(db, channel.id)
                      .then(result => CreateFollowupMessage(token, process.env.APP_ID!, 'created ' + result.length + ' characters'));
                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  case NpcCommands.Create:
                    psql()
                      .then(characterData.create(subdata.options[0]?.value, channel.id, {
                        traits: subdata.options[1]?.value,
                        backstory: subdata.options[2]?.value
                      }, true))
                      .then(() =>
                        CreateFollowupMessage(
                          token,
                          process.env.APP_ID!,
                          `${user} has brought ${subdata.options[0]?.value} into the chat`
                        )
                      );
                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  case NpcCommands.Ask:
                    generateAskResponse(
                      db,
                      subdata.options[1]?.value,
                      channel.id,
                      user,
                      parseInt(subdata.options[0]?.value)
                    ).then(response => splitUpFollowup(response, CreateFollowupMessage.bind(null, token, process.env.APP_ID!)));

                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  case NpcCommands.List:
                    psql()
                      .then(characterData.list(channel.id))
                      .then((c) =>
                        CreateFollowupMessage(
                          token,
                          process.env.APP_ID!,
                          `Here are the characters in this channel: \n${c.map(c => c.name).join("\n")}`
                        )
                      );

                    return reply({
                      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                    });

                  case NpcCommands.Mold:
                    const id = subdata.options[0]?.value;
                    const attribute = subdata.options[1]?.value;
                    const value = subdata.options[2]?.value;
                    psql()
                      .then(characterData.appendState(id, attribute, value))
                      .then(() =>
                        CreateFollowupMessage(
                          process.env.APP_ID!,
                          token,
                          `molded character to have attribute ${attribute} set to '${value}'`
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
              case CommandType.Fork:

                if (user !== 'darthvadrismydad') {
                  throw new Error('someone else tried to use fork!');
                }

                const forkName: string = data.options[0].value!;
                const description: string = data.options[1]?.value!;
                CreateChannel(process.env.SERVER_ID!, forkName, description).then(async (chan) => {
                  await psql().then(timelineData.create(chan.id, channel.id));
                  await CreateFollowupMessage(token, process.env.APP_ID!, `created channel ${forkName}`)
                });

                return reply({
                  type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
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

