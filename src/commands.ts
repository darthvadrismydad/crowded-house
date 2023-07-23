import { InstallGlobalCommands } from './utils';

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
};

const PROMPT_COMMAND = {
  name: 'prompt',
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

const ALL_COMMANDS = [TEST_COMMAND, PROMPT_COMMAND];

InstallGlobalCommands(process.env.APP_ID!, ALL_COMMANDS);
