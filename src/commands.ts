export enum CommandType {
  Test = "test",
  Prompt = "prompt",
  Continue = "continue",
  SpawnCharacter = "spawnc",
  Ask = "ask"
}

export const Commands = new Map<CommandType, any>()
  .set(
    CommandType.Test,
    {
      description: 'Basic command',
      type: 1
    }
  )
  .set(CommandType.Prompt,
    {
      description: 'move the story onwards',
      type: 1,
      options: [
        {
          name: 'text',
          require: true,
          type: 3,
          description: 'text to prompt with',
        }
      ]
    }
  )
  .set(CommandType.Continue,
    {
      description: 'continue the story',
      type: 1
    }
  )
  .set(CommandType.SpawnCharacter,
    {
      description: 'create a new NPC',
      type: 1,
      options: [
        {
          name: 'name',
          require: true,
          type: 3,
          description: 'name of the NPC',
        },
        {
          name: 'traits',
          require: true,
          type: 3,
          description: 'traits of the NPC',
        },
        {
          name: 'backstory',
          require: true,
          type: 3,
          description: 'backstory of the NPC'
        }
      ]
    }
  )
  .set(CommandType.Ask,
    {
      description: 'ask a question to an NPC',
      type: 1,
      options: [
        {
          name: 'npc',
          description: 'the npc to ask',
          require: true,
          type: 3,
        },
        {
          name: 'question',
          require: true,
          description: 'the question to ask',
          type: 3,
        }
      ]
    }
  );
