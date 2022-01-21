var Gameboy = require('serverboy');
// eslint-disable-next-line @typescript-eslint/no-var-requires
import fs from 'fs';
import { PNG } from 'pngjs';
import { Scale } from './Config';
import {
  FRAME_WAIT,
  KEY_HOLD_DURATION,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from './Constants';
import { Log } from './Log';
import { KeysToPress } from './types/KeysToPress';
import { MemoryReader } from './MemoryReader';
import { Stats } from './types/Stats';

import {
  Romfile,
} from './Config';
import { debug } from 'console';


class GameboyClient {
  private _timer: NodeJS.Timeout | null;
  private _rendering: boolean;
  private _buffer: Buffer;
  private _keysToPress: KeysToPress;
  private _keyRepeat: number;
  private _waitFrameCounter: number;
  private _gameboy;
  private _hyperSpeed: boolean;

  constructor() {
    this._gameboy = new Gameboy();
    this._timer = null;
    this._rendering = false;
    this._buffer = Buffer.from([]);
    this._keysToPress = {};
    this._keyRepeat = 0;
    this._waitFrameCounter = 0;
    this._hyperSpeed = false;
  }

  hyperSpeedOn(): void {
    this._hyperSpeed = true;
  }

  loadRom(rom: Buffer): void {
    this._gameboy.loadRom(rom);
  }

  gameAdvance(): void {
    var repeatAmount = 1;
    if (this._hyperSpeed) {
      this._hyperSpeed = false;
      repeatAmount = 1000;
    }
    for (let i = 0; i < repeatAmount; i++) {
      this._gameboy.doFrame();

      if (this._waitFrameCounter > 0) {
        this._waitFrameCounter--;
      } else {
        // This is to hold the button for multiple frames to aid button registration
        Object.keys(this._keysToPress).forEach((key) => {
          if (this._keysToPress[key] > 0) {
            this._keysToPress[key]--;
            this._gameboy.pressKey(key);
          }
        });
        const sum = Object.values(this._keysToPress).reduce(
          (acc, val) => acc + val,
          0
        );
        if (this._keyRepeat > 0 && sum === 0) {
          this._waitFrameCounter = FRAME_WAIT;
          this._keyRepeat--;
          Object.keys(this._keysToPress).forEach((key) => {
            this._keysToPress[key] = KEY_HOLD_DURATION;
          });
        }
      }
    }
  }

  start(): void {
    // this._timer = setInterval(() => this.gameAdvance(), 1);
    this._timer = setInterval(() => this.gameAdvance(), 1000/60);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
    }
  }

  pressKey(key: string, repeat = 1): void {
    for (const member in this._keysToPress) delete this._keysToPress[member];

    Log.info(`Pressing ${key}`);
    this._keysToPress[key] = KEY_HOLD_DURATION;
    this._keyRepeat = repeat - 1;
  }

  getFrame(): Buffer {
    if (!this._rendering) {
      this._rendering = true;
      const screen = this._gameboy.getScreen();

      const png = new PNG({
        width: SCREEN_WIDTH * Scale,
        height: SCREEN_HEIGHT * Scale,
      });

      if (Scale === 1) {
        for (let i = 0; i < screen.length; i++) {
          png.data[i] = screen[i];
        }
      } else {
        // TODO fix this inefficient code
        const rows: number[][] = [];
        for (let i = 0; i < SCREEN_HEIGHT; i++) {
          // Times 4 because of RGBA
          const row = screen.splice(0, SCREEN_WIDTH * 4);

          const newRow: number[] = [];
          for (let j = 0; j < SCREEN_WIDTH; j++) {
            const pixel = row.splice(0, 4);
            for (let scalerIndex = 0; scalerIndex < Scale; scalerIndex++) {
              newRow.push(...pixel);
            }
          }
          for (let scalerIndex = 0; scalerIndex < Scale; scalerIndex++) {
            rows.push(newRow.flat());
          }
        }
        png.data = Buffer.from(rows.flat());
      }

      this._buffer = PNG.sync.write(png);
      this._rendering = false;
    }
    return this._buffer;
  }
  // TODO only save when savefile changed
  async newSaveState(fileName?: string): Promise<string> {
    let savePath = fileName;
    if (savePath) {
      savePath = savePath.replace(/[^\w\s]/gi, '');
    } else {
      savePath = new Date().toISOString();
    }
    savePath = savePath.replace(/[:.]+/g, '');
    savePath = './saves/' + savePath + '.sav';
    Log.debug('savePath: ' + savePath);

    const sram = Buffer.from(this._gameboy.getSaveData());
    Log.debug('save size: ' + sram.length);
    // Log.debug('type: ' + typeof sram + ', ' + sram.constructor.name);
    // Log.debug('data: ' + sram.toString());
    fs.writeFileSync(savePath, sram);
    Log.info('Saved new savefile to ', savePath);
    return savePath;
  }

  async loadSaveState(fileName: string): Promise<void> {
    const sram = Buffer.from(fs.readFileSync('./saves/' + fileName));
    
    let rom: Buffer;
    try {
      rom = fs.readFileSync('./roms/' + Romfile);
    } catch (error) {
      Log.error(
        `Rom file ${Romfile} could not be found in your './roms' directory`
      );
      return;
    }
    
    this._gameboy.loadRom(rom, sram);
  }

  async getSaveStates(): Promise<string[]> {
    const dir = './saves/';
    const saveStatesPromise = (await fs.readdirSync(dir))
      .filter((filename) => filename.endsWith('.sav'))
      .map(async (filename) => ({
        filename,
        time: (fs.statSync(dir + filename)).mtime.getTime(),
      }));
    const saveStates = await Promise.all(saveStatesPromise);

    saveStates.sort((a, b) => b.time - a.time);

    return saveStates.map(({ filename }) => filename);
  }

  getStats(): Stats {
    const memory = new MemoryReader(Object.values(this._gameboy.getMemory()));
    return memory.readStats();
  }

  setFastRead(): void {
    this._gameboy.getMemory()[0xd355] = 0x00;
  }
}

const instance = new GameboyClient();

export function getGameboyInstance(): GameboyClient {
  return instance;
}
