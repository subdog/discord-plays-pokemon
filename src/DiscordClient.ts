import Discord, {
  Intents,
  MessageActionRow,
  MessageAttachment,
  MessageEmbed,
  MessageOptions,
  TextChannel,
} from 'discord.js';
import glob from 'glob';
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
        if (command.adminOnly) {
          const isAdmin = message.member?.permissions.has('ADMINISTRATOR')
          var hasAccessAnyway = false;
          if (! isAdmin ) {
            hasAccessAnyway = message.member?.roles.cache.some(role => role.name === 'Not3D')?true:false;
          }
          if (command.adminOnly && (! isAdmin && ! hasAccessAnyway)) {
            this.sendMessage('This command is for admins only');
          } else {
            command.execute(message, args);
          }
        }
        else {
          command.execute(message, args);
        }
      }

    });
    this._client.login(this._token);
  }


  async sendMessage(
    text: string | MessageEmbed,
    attachment?: MessageAttachment,
    row?: MessageActionRow[],
    interaction?: Discord.MessageComponentInteraction<Discord.CacheType>
  ) {
    if (!this._channel) {
      throw new Error(
        'Could not send message, text channel was not initialised yet.'
      );
    }

    var mo: MessageOptions;
    mo = {};
    if (typeof text == "string") {
      mo.content = text;
    }
    else {
      mo.embeds = [text];
    }
    if (attachment) {
      mo.files = [attachment];
    }
    if (row) {
      mo.components = row;
    }
    if (interaction) {
      try {
        await interaction.reply(mo);
        return interaction.fetchReply() as Promise<Discord.Message<boolean>>;
      }
      catch (error) {
        Log.error('Failed to reply to interaction.')
        Log.error(error)
      }
    }
    else {
      return this._channel.send(mo);
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
