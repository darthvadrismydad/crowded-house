import 'dotenv/config';
import { CreateFollowupMessage } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { psql } from './db';
import characterData, { Character } from './db/character';
import directiveData from './db/directive';
import memoryData from './db/memories';
import { Client } from 'ts-postgres';


const DEFAULT_SYS_MSG = 'you are narrating a story which involves multiple 1st person perspectives. always use the third person.';

export async function generateCompletion(
  client: Client,
  prompt: string,
  channelId: string,
  author: string,
  token: string
): Promise<any> {
  const bot = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY!
  }));

  const directive = await directiveData.get(channelId)(client).catch(() => DEFAULT_SYS_MSG);
  const memories = await memoryData.list(channelId)(client);
  const others = (await characterData.list(channelId)(client));
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
        name: prompt === 'continue' ? undefined : author.replaceAll('.', '')
      }
    ],
    user: author
  };

  const response = await bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string);

  await psql().then(memoryData.create(channelId, response, {
    dateTime: new Date().toISOString(),
  }));

  const words = response.split(' ');

  let size = 0;
  let fragment: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if ((fragment.length + size + w.length) >= 2000 || i === words.length - 1) {
      const content = fragment.join(' ');
      console.log('sending this many chars:', content.length);
      await CreateFollowupMessage(process.env.APP_ID!, token, content);
      size = 0;
      fragment = [];
    }
    size += w.length;
    fragment.push(w);
  }
}
