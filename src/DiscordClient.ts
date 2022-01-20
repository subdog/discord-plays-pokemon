import Discord, {
  Intents,
  MessageAttachment,
  MessageEmbed,
  TextChannel,
} from 'discord.js';
import glob from 'glob';
import { type } from 'os';
import { promisify } from 'util';
import { DiscordChannelId, Prefix } from './Config';
import { Log } from './Log';
import { Command } from './types/Command';

const globPromise = promisify(glob);

class DiscordClient {
  getChannel() {
    throw new Error('Method not implemented.');
  }
  private _token: string;
  private _client: Discord.Client;
  private _channel: Discord.TextChannel;
  private _commands: Command[];
  public sendingMessage: boolean;
  public failedAttempts: number;

  get commands() {
    return this._commands;
  }

  constructor(token: string) {
    this._token = token;
    const myIntents = new Intents();
    myIntents.add(Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS);
    this._client = new Discord.Client({ intents: myIntents });
    this._channel = this._client.channels.cache.get(
      DiscordChannelId
    ) as TextChannel;
    this._commands = [];
    this.sendingMessage = false;
    this.failedAttempts = 0;
  }

  start() {
    this._client.on('ready', async () => {
      Log.info(`Logged in!`);
      this._channel = this._client.channels.cache.get(
        DiscordChannelId
      ) as TextChannel;
      if (this._client.user) {
        var presence = this._client.user
        .setActivity(`${Prefix}help`, { type: 'LISTENING' })
        Log.info(`Activity set to ${presence.activities[0].name}`)
      }
      const commandFiles = await globPromise(`${__dirname}/commands/*.{js,ts}`);

      for (const file of commandFiles) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const command = require(file) as Command;
        Log.info('Added command', command.names[0]);
        this._commands.push(command);
      }
    });

    this._client.on('message', async (message) => {
      if (
        !message.guild ||
        message.author.bot ||
        message.channel.id !== DiscordChannelId ||
        !message.content.startsWith(Prefix)
      ) {
        return;
      }

      const [commandName, ...args] = message.content
        .slice(Prefix.length)
        .split(/ +/);

      const command = this._commands.find((c) => c.names.includes(commandName));

      if (command) {
        const isAdmin = message.member?.permissions.has('ADMINISTRATOR');
        if (command.adminOnly && !isAdmin) {
          this.sendMessage('This command is for admins only');
        } else {
          command.execute(message, args);
        }
      } else {
        this.sendMessage(
          `Unrecognized command. Type \`${Prefix}help\` for the list of commands.`
        );
      }
    });
    this._client.login(this._token);
  }

  async sendMessage(
    text: string | MessageEmbed,
    attachment?: MessageAttachment
  ) {
    if (!this._channel) {
      throw new Error(
        'Could not send message, text channel was not initialised yet.'
      );
    }
    
    if (typeof text == "string"){
      if (attachment) {
        return this._channel.send({content: text, files: [attachment]});
      } else {
        return this._channel.send(text);
      }
    } else if (text instanceof MessageEmbed){

      if (attachment) {
        return this._channel.send({embeds: [text], files: [attachment]});
      } else {
        return this._channel.send({embeds: [text]});
      }
    } else {
      Log.error('Unknown message content type.');
      return;
    }

  }
}

let instance: DiscordClient | null = null;

export function initDiscord(token: string): void {
  instance = new DiscordClient(token);
}

export function getDiscordInstance(): DiscordClient | null {
  return instance;
}
