import { InteractionType, InteractionResponseType, } from 'discord-interactions';
import { CreateFollowupMessage, GetChannelMessages } from './utils';
import { Configuration, OpenAIApi } from 'openai';

const bot = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY!
}));

export default {
  async fetch(req: Request) {

    const { type, data, channel, token } = await req.json<any>();

    switch (type) {
      case InteractionType.PING:
        return { type: InteractionResponseType.PONG };
      case InteractionType.APPLICATION_COMMAND:
        const { name } = data;
        switch (name.toLowerCase()) {
          case 'test':
            return GetChannelMessages(channel.id).then(c => c[0].content)
              .then(msg =>
                new Response(JSON.stringify({
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: JSON.stringify(msg)
                  }
                })));
          case 'prompt':
            // chat-gippity will almost never return in the 3 second discord response window, 
            // so we need to tell discord to not wait for us to respond
            // this involves a followup message
            context.callbackWaitsForEmptyEventLoop = false;

            const text = data.options[0]?.value;
            callback({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

            // actual response
            setTimeout(function() {
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
                .then((msg: string) => CreateFollowupMessage(process.env.APP_ID!, token, msg))
            }, 10 * 1000);

          default:
            break;
        }
      default:
        break;
    }

    callback("unknown interaction type", 404);
  };

