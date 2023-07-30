import { MessageComponent, MessageComponentTypes } from 'discord-interactions';
export enum CommandType {
  Test = "test",
  Prompt = "prompt",
  Continue = "continue",
  CreateDirective = "direct",
  Npcs = "npcs",
}

export enum NpcCommands {
  Create = "create",
  List = "list",
  Ask = "ask",
}

// command types for discord interactions
enum ApplicationCommandTypes {
  // slash commands
  ChatInput = 1,
  // a command that shows when you right-click on a user
  User = 2,
  // a command that shows when you right-click on a message
  Message = 3,
}

export const Commands = new Map<CommandType, any>()
  .set(
    CommandType.Test,
    {
      description: 'Basic command',
      type: ApplicationCommandTypes.ChatInput
    }
  )
  .set(CommandType.Prompt,
    {
      description: 'move the story onwards',
      type: ApplicationCommandTypes.ChatInput,
      options: [
        {
          name: 'text',
          required: true,
          type: MessageComponentTypes.STRING_SELECT,
          description: 'text to prompt with',
        }
      ]
    }
  )
  .set(CommandType.Continue,
    {
      description: 'continue the story',
      type: ApplicationCommandTypes.ChatInput
    }
  )
  .set(CommandType.CreateDirective,
    {
      description: 'create a new directive',
      type: ApplicationCommandTypes.ChatInput,
      options: [
        {
          name: 'directive',
          type: MessageComponentTypes.STRING_SELECT,
          description: 'the directive to create',
          required: true
        }
      ]
    }
  )
  .set(CommandType.Npcs,
    {
      description: 'interact with NPCs',
      options: [
        {
          name: NpcCommands.Ask,
          description: 'ask a question to an NPC',
          type: ApplicationCommandTypes.ChatInput,
          options: [
            {
              name: 'npc',
              description: 'the npc to ask',
              required: true,
              type: MessageComponentTypes.STRING_SELECT,

            },
            {
              name: 'question',
              required: true,
              description: 'the question to ask',
              type: MessageComponentTypes.STRING_SELECT,
            }
          ]
        },
        {
          name: NpcCommands.Create,
          description: 'create a new NPC',
          type: ApplicationCommandTypes.ChatInput,
          options: [
            {
              name: 'name',
              required: true,
              type: MessageComponentTypes.STRING_SELECT,
              description: 'name of the NPC',
            },
            {
              name: 'traits',
              required: true,
              type: MessageComponentTypes.STRING_SELECT,
              description: 'traits of the NPC',
            },
            {
              name: 'backstory',
              required: true,
              type: MessageComponentTypes.STRING_SELECT,
              description: 'backstory of the NPC'
            }
          ]
        },
        {
          name: 'list',
          description: 'list all NPCs',
          type: ApplicationCommandTypes.ChatInput
        }
      ]
    }
  );
