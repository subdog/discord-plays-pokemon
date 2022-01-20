import { Message, MessageEmbed } from 'discord.js';
import { Prefix } from '../Config';
import { getDiscordInstance } from '../DiscordClient';
import { getGameboyInstance } from '../GameboyClient';
import { Log } from '../Log';
import { Command } from '../types/Command';

const command: Command = {
  names: ['info', 'i'],
  description: 'Show info about the player and the pokemon in the party.',
  execute,
  adminOnly: false,
};

// function safeEmbedAddField(embed: MessageEmbed, name: string, value: string, inline?: boolean){
//   embed.addField(name, value, inline);
// }

function execute(_msg: Message, args: string[]): void {
  const client = getDiscordInstance();
  if (!client) {
    throw new Error('Discord did not initialize');
  }
  const stats = getGameboyInstance().getStats();

  if (args.length === 0) {
    const shortEmbed = new MessageEmbed();
    shortEmbed.setAuthor({name: stats.playerName});
    shortEmbed.addField('Money', '§' + stats.money, true);
    if (! stats.rivalName) {
      shortEmbed.addField('Rival', '???', true);
    } else {
      shortEmbed.addField('Rival', stats.rivalName, true);
    }

    shortEmbed.addField('Time', stats.time, true);
    shortEmbed.addField(
      'Location',
      `${stats.location.name}\nRun \`${Prefix}map\` for full map`,
      true
    );

    stats.pokemon.forEach(({ nickname, name, level, hp, maxHP }, i) => {
      shortEmbed.addField(
        `${i + 1} ${nickname}`,
        `${name} lvl ${level}\n${hp}/${maxHP} HP`,
        true
      );
    });
    shortEmbed.addField(
      'Detailed info',
      `Run \`${Prefix}info 1\` to view info about the first pokémon, \`${Prefix}info 2\` for the second and so on.`
    );
    const badges = stats.gyms
      .map(({ name, done }) => `${name}: ${done ? 'Done' : 'Not done'}`)
      .join(', ');
    shortEmbed.addField('Badges', badges);

    client.sendMessage(shortEmbed);
  } else {
    try {
      const pokemonIndex = parseInt(args[0]) - 1;
      if (pokemonIndex > stats.pokemon.length) {
        throw new Error('Invalid pokemon index');
      }

      const pokemon = stats.pokemon[pokemonIndex];
      const pokemonEmbed = new MessageEmbed();
      let status = Object.keys(pokemon.status)
        .filter((status) => pokemon.status[status])
        .join(', ');
      if (status === '') {
        status = 'No status';
      }
      pokemonEmbed.setAuthor(pokemon.nickname);
      pokemonEmbed.setTitle(`${pokemon.name} lvl ${pokemon.level}`);
      pokemonEmbed.setURL(pokemon.url);
      pokemonEmbed.setThumbnail(pokemon.image);
      pokemonEmbed.addField('HP', `${pokemon.hp}/${pokemon.maxHP}`, true);

      pokemonEmbed.addField('Type', pokemon.types.join(', '), true);
      pokemonEmbed.addField('Status', status, true);
      pokemonEmbed.addField(
        'Moves',
        pokemon.moves
          .map(({ name, pp, maxPp }) => `${name} ${pp}/${maxPp} PP`)
          .join(', ')
      );
      pokemonEmbed.addField('Attack', pokemon.attack.toString(), true);
      pokemonEmbed.addField('Defense', pokemon.defense.toString(), true);
      pokemonEmbed.addField('Speed', pokemon.speed.toString(), true);
      pokemonEmbed.addField('Special', pokemon.special.toString(), true);

      client.sendMessage(pokemonEmbed);
    } catch (error) {
      client.sendMessage(
        `Invalid pokémon index given. Run \`${Prefix}info 1\` to view info about the first pokémon, \`${Prefix}info 2\` for the second and so on.`
      );
    }
  }
}
export = command;
