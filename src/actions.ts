import character, { Character } from './db/character';
import { psql } from './db';

export async function getCharacterInfo(name: string, channelId: number): Promise<Character> {
  return psql().then(character.getByName(name, channelId));
}
