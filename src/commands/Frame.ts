import Discord, {
  Message,
  MessageActionRow,
  MessageButton,
} from 'discord.js';
import {
  GIF_MAX_IMAGES
} from '../Constants';
import fs from 'fs/promises';
import { getDiscordInstance } from '../DiscordClient';
import { ButtonIdMapping } from '../enums/ButtonIdMapping';
import { getGameboyInstance } from '../GameboyClient';
import { Log } from '../Log';
import { Command } from '../types/Command';
import { makeGif } from '../Gifmaker';

var previousInteraction: Discord.MessageComponentInteraction<Discord.CacheType>;
var imageCountForGif = 0;
const IMAGE_COUNT_MAX = GIF_MAX_IMAGES;

const command: Command = {
  names: ['frame', 'f'],
  description: 'Show the latest frame and listen for buttons to press.',
  execute,
  adminOnly: false,
};

function execute(): void {
  const client = getDiscordInstance();
  postFrame(true);
}

async function postFrame(isManuallyInvoked?: boolean) {
  let reactionsLoaded = false;
  const buffer = getGameboyInstance().getFrame();
  const attachment = new Discord.MessageAttachment(buffer, 'frame.png');
  const client = getDiscordInstance();
  if (!client) {
    throw new Error('Discord client not initialised');
  }
  const firstRow = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('left')
        .setLabel('⯇')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('down')
        .setLabel('⯆')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('up')
        .setLabel('⯅')
        .setStyle('PRIMARY'),
      new MessageButton()
        .setCustomId('right')
        .setLabel('⯈')
        .setStyle('PRIMARY'),
    );
  const secondRow = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId('a')
        .setLabel('A')
        .setStyle('SUCCESS'),
      new MessageButton()
        .setCustomId('b')
        .setLabel('B')
        .setStyle('SUCCESS'),
      new MessageButton()
        .setCustomId('start')
        .setLabel('+')
        .setStyle('DANGER'),
      new MessageButton()
        .setCustomId('select')
        .setLabel('-')
        .setStyle('DANGER'),
      new MessageButton()
        .setCustomId('refresh')
        .setLabel('↺')
        .setStyle('SECONDARY'),
    );

  const allRows = [firstRow, secondRow];
  var message;
  if (previousInteraction && !isManuallyInvoked) {
    message = await client.sendMessage(
      ' ',
      attachment,
      allRows,
      previousInteraction
    );
  } else {
    message = await client.sendMessage(
      ' ',
      attachment,
      allRows
    );
  }

  try {
    var filename = new Date().toISOString().replace(/[:.]+/g, '');
    await fs.writeFile(
      `./frames/current/${filename}.png`,
      buffer
    );
  } catch (error) {
    Log.error('Failed to write frame to disk');
  }

  if (message == undefined) {
    Log.error('Message is undefined.');
    return;
  }

  const filter = () => true;
  const collector = message.createMessageComponentCollector({ filter, max: 5 });

  // const collectedReactions: CollectedReactions = {};
  const collectedButtonPushes =
    collector.on('collect', async i => {
      previousInteraction = i;
      if (!i.isButton()) return;
      const action = i.customId;
      Log.info(`Collected ${action} from ${i.user}`);
      const actionKey = ButtonIdMapping[action as keyof typeof ButtonIdMapping];
      let repeat = 1;
      getGameboyInstance().hyperSpeedOn();
      getGameboyInstance().pressKey(actionKey, repeat);

      const delay = (1000 / 60) + 1;

      setTimeout(() => { postNewFrame(); }, delay);
      const previousMessage = i.message as Message<boolean>;
      setTimeout(() => { previousMessage.edit({ components: [] }); }, delay);
      setTimeout(() => { collector.stop() }, 10000);
    });

    // If enough images, call gifmaker
    gifCheck()
}

function gifCheck() {
  imageCountForGif++;
  if (imageCountForGif >= IMAGE_COUNT_MAX) {
    imageCountForGif = 0;
    makeGif();
  }
}

function postNewFrame() {
  const client = getDiscordInstance();
  if (!client) {
    throw new Error('Discord client not initialised');
  }
  postFrame(false);
}

export = command;
