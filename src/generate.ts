import { stringify, CreateFollowupMessage } from './utils';
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import characterData from './db/character';
import directiveData from './db/directive';
import memoryData from './db/memories';
import { Client } from 'ts-postgres';
import timelineData from './db/timelines';


const DEFAULT_SYS_MSG = 'you are narrating a story which involves multiple 1st person perspectives. always use the third person.';

export async function generateCompletion(
  client: Client,
  prompt: string,
  channelId: number,
  author: string,
  token: string
): Promise<any> {
  const bot = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY!
  }));

  const timeline = await timelineData.getParent(channelId)(client).catch(() => null);
  const channels = [timeline, channelId].filter(c => c) as number[];
  const memories = await memoryData.list(channels)(client);

  const directive = await directiveData.get(channelId)(client).catch(() => DEFAULT_SYS_MSG);
  const others = (await characterData.list(channels)(client));
  const introduce = !others.some(o => o.name === author);
  const story = memories.map(m => m.memory).join(' ');

  const messages: CreateChatCompletionRequest['messages'] = [
    {
      content: `
          you are a helpful storyteller, working with player characters to tell a story.
          this is a never-ending saga. because there is no end, do not end responses with happily ever after verbage.
          always leave room for the player characters to continue the story!
        `,
      role: 'system',
    },
    {
      content: directive,
      role: 'system'
    },
    {
      content: `${prompt === 'continue' ? 'the narrator' : author.replaceAll('.', '')} is continuing the story`,
      role: 'assistant',
      name: prompt === 'continue' ? undefined : author.replaceAll('.', '')
    },
    {
      content: 'the characters in the story are:' + stringify(others),
      role: 'assistant'
    },
    {
      content: 'what has happened so far: ' + story,
      role: 'assistant'
    },
  ];

  if (introduce) {
    messages.push({
      role: 'user',
      content: `a new player, named ${author}, has entered the story. weave them into the story!`
    });
  }

  messages.push({
    content: prompt,
    role: 'user',
    name: prompt === 'continue' ? undefined : author.replaceAll('.', '')
  });

  const msg: CreateChatCompletionRequest = {
    model: 'gpt-4o',
    temperature: 0.37,
    messages,
    user: author
  };

  const response = await bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string);

  console.log('response size:', response.length);

  await memoryData.create(channelId, response)(client);
  if (introduce) {
    await characterData.create(author, channelId, {})(client);
  }

  await splitUpFollowup(token, response);
}

export async function generateAskResponse(
  client: Client,
  question: string,
  channelId: number,
  author: string,
  characterId: number,
  token: string
): Promise<any> {
  const bot = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY!
  }));

  const timeline = await timelineData.getParent(channelId)(client).catch(() => null);
  const channels = [timeline, channelId].filter(c => c) as number[];
  const memories = await memoryData.list(channels, characterId)(client);
  const all = (await characterData.list(channels)(client));
  const character = all.find(c => c.id === characterId);
  const others = all.find(c => c.id !== characterId);
  const authorData = all.find(c => c.name === author);
  const story = memories.join('\n');

  const msg: CreateChatCompletionRequest = {
    model: 'gpt-4o',
    temperature: 0.37,
    messages: [
      {
        content: `
          you are a character in a story. you will respond in the first person and treat the other characters as if they are real people.
          the other characters in the story are: ${stringify(others)}.
          your current knowledge of the story is: ${story}.
          your current state of being is represented by this json object: ${stringify(character)}.
          you will answer all questions from the perspective of character ${character!.name}, making sure to be a convincing rendition of the character.
        `,
        role: 'system'
      },
      {
        content: `${author} asks: "${question}"`,
        role: 'user',
        name: author.replaceAll('.', '')
      }
    ],
    user: author
  };

  const response = await bot.createChatCompletion(msg)
    .then(r => r.data?.choices[0]?.message?.content as string);

  // TODO: ensure author actually exists first
  await memoryData.create(channelId, question, characterId, authorData!.id)(client);

  await splitUpFollowup(token, response);
}

export async function generateCharacters(
  client: Client,
  channelId: number,
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
    model: 'gpt-4o',
    temperature: 0.37,
    messages: [
      {
        content: directive,
        role: 'system'
      },
      {
        content: 'the characters in the story are:' + stringify(others),
        role: 'assistant'
      },
      {
        content: 'what has happened so far: ' + story,
        role: 'assistant'
      },
      {
        content: `
          generate a valid json array that contains each character that has been mentioned in the story.
          exclude the characters named: ${others.map(o => o.name).join(', ')}
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

  for (const { name, ...state } of (result.characters ?? result)) {
    if (!(await characterData.getByName(name, channelId)(client).then(() => true).catch(() => false))) {
      await characterData.create(
        name,
        channelId, 
        state,
        true
      )(client);
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
