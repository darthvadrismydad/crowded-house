import { MessageComponentTypes,  } from 'discord-interactions';
export enum CommandType {
  Test = "test",
  Prompt = "prompt",
  Continue = "continue",
  CreateDirective = "direct",
  Npcs = "npcs",
  Fork = "fork"
}

export enum NpcCommands {
  Create = "create",
  List = "list",
  Ask = "ask",
  AutoGenerate = "autogen",
  Mold = "mold",
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
      type: ApplicationCommandTypes.ChatInput,
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
          required: true,
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
              autocomplete: true
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
          name: NpcCommands.Mold,
          description: 'mold an NPC',
          type: ApplicationCommandTypes.ChatInput,
          options: [
            {
              name: 'npc',
              required: true,
              autocomplete: true,
              type: MessageComponentTypes.STRING_SELECT,
              description: 'name of the NPC',
            },
            {
              name: 'attribute',
              required: true,
              type: MessageComponentTypes.STRING_SELECT,
              description: 'the field to change',
            },
            {
              name: 'value',
              required: true,
              type: MessageComponentTypes.STRING_SELECT,
              description: 'the value to set the field to'
            }
          ]
        },
        {
          name: NpcCommands.List,
          description: 'list all NPCs',
          type: ApplicationCommandTypes.ChatInput
        },
        {
          name: NpcCommands.AutoGenerate,
          description: 'generates NPCs based on the story so far',
          type: ApplicationCommandTypes.ChatInput
        }
      ]
    }
  )
  .set(CommandType.Fork, {
    description: 'spin off a new story where an alternate timeline can take place!',
    type: ApplicationCommandTypes.ChatInput,
    options: [
      {
        name: 'name',
        required: true,
        type: MessageComponentTypes.STRING_SELECT,
        description: 'name of the new alternate reality',
      },
      {
        name: 'description',
        type: MessageComponentTypes.STRING_SELECT,
        description: 'describe the new alternate reality',
      }
    ]
  });
