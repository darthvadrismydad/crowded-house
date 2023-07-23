import { InstallGlobalCommands } from './utils';

export enum CommandType {
  Test = "test",
  Prompt = "prompt",
  Continue = "continue"
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
  );


const FormattedCommands = Array.from(Commands.entries()).map(([name, value]) => ({ name, ...value }));
InstallGlobalCommands(process.env.APP_ID!, FormattedCommands);

