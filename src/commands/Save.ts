import { Message } from 'discord.js';
import { getDiscordInstance } from '../DiscordClient';
import { getGameboyInstance } from '../GameboyClient';
import { Command } from '../types/Command';

const command: Command = {
  name: 'save',
  description:
    'Save the current state to a new file. Optionally supply a filename, otherwise the timestamp will be used',
  execute,
};

async function execute(msg: Message, args: string[]) {
  let savedFileLocation: string;
  if (args.length === 0) {
    savedFileLocation = getGameboyInstance().newSaveState();
  } else {
    const filename = args.join('_');
    savedFileLocation = getGameboyInstance().newSaveState(filename);
  }
  getDiscordInstance()!.sendMessage(`Saved to \`${savedFileLocation}\``);
}
export = command;