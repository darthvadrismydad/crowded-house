import { CreateFollowupMessage } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import characterData from './db/character';
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

  console.log('response size:', response.length);

  await memoryData.create(channelId, response, {
    dateTime: new Date().toISOString(),
  })(client);

  await splitUpFollowup(token, response);
}

export async function generateAskResponse(
  client: Client,
  question: string,
  channelId: string,
  author: string,
  characterId: number,
  token: string
): Promise<any> {
  const bot = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY!
  }));

  const memories = (await memoryData.list(channelId)(client)).filter(m => !m.facts?.perspectiveOf || m.facts?.perspectiveOf?.id === characterId);
  const all = (await characterData.list(channelId)(client));
  const character = all.find(c => c.id === characterId);
  const others = all.find(c => c.id !== characterId);
  const story = memories.map(m => `${(m.facts?.perspectiveOf?.name + ': ') ?? ''}${m.memory}`).join('\n');

  const msg: CreateChatCompletionRequest = {
    model: 'gpt-3.5-turbo-16k',
    messages: [
      {
        content: `
          you are a character in a story. you will respond in the first person and treat the other characters as if they are real people.
          the other characters in the story are: ${JSON.stringify(others)}.
          your current knowledge of the story is: ${story}.
          your current state of being is represented by this json object: ${JSON.stringify(character)}.
          you will answer all questions from the perspective of character ${character!.name}, making sure to be a convincing rendition of the character.
        `,
        role: 'system'
      },
      {
        content: `Question by ${author}: ${question}`,
        role: 'user',
        name: author.replaceAll('.', '')
      }
    ],
    user: author
  };

  const response = await bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string);

  await memoryData.create(channelId, response, {
    perspectiveOf: character,
    dateTime: new Date().toISOString(),
  })(client);

  await splitUpFollowup(token, response);
}

export async function generateCharacters(
  client: Client,
  channelId: string,
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
        content: `
          generate a valid json array that contains each character that has been mentioned in the story.
          take note of how the character feels about the other characters and the events that have happened.
          the json format of each character is "{ name: string, traits: string[], relationships: { [name: string]: string }, memories: string[] }".
        `,
        role: 'user',
      }
    ]
  };

  const response = await bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string);

  const array = response.substring(response.indexOf('['), response.lastIndexOf(']') + 1);

  console.log('character creation:', array);

  const result = JSON.parse(array);

  for (const character of (result.characters ?? result)) {
    if (!(await characterData.getByName(character.name, channelId)(client).then(() => true).catch(() => false))) {
      await characterData.create(character.name, channelId, {
        traits: character.traits,
        relationships: character.relationships
      })(client);
    }
    for (const memory of character.memories) {
      await memoryData.create(channelId, memory, {
        dateTime: new Date().toISOString(),
      })(client);
    }
  }

  await CreateFollowupMessage(process.env.APP_ID!, token, 'created ' + result.length + ' characters');
}

async function splitUpFollowup(token: string, response: string) {
  if (response.length < 2000) {
    await CreateFollowupMessage(process.env.APP_ID!, token, response);
    return;
  }

  const words = response.split(' ');
  let size = 0;
  let fragment: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if ((fragment.length + size + w.length) >= 2000) {
      const content = fragment.join(' ');
      console.log('sending this many chars:', content.length);
      await CreateFollowupMessage(process.env.APP_ID!, token, content);
      size = 0;
      fragment = [];
    }
    size += w.length;
    fragment.push(w);
  }

  if (fragment.length > 0) {
    const content = fragment.join(' ');
    console.log('sending this many chars:', content.length);
    await CreateFollowupMessage(process.env.APP_ID!, token, content);
  }
}
