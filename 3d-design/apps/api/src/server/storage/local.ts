import fs from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from '../types';

/** Files under DATA_DIR/storage. Dev and single-node only. */
export class LocalStorage implements Storage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep))
      throw new Error('invalid storage key');
    return full;
  }

  async put(key: string, body: Uint8Array, contentType: string) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    await fs.writeFile(`${file}.type`, contentType);
  }

  async get(key: string) {
    const file = this.resolve(key);
    try {
      const [body, contentType] = await Promise.all([
        fs.readFile(file),
        fs.readFile(`${file}.type`, 'utf8').catch(() => 'application/octet-stream'),
      ]);
      return { body: new Uint8Array(body), contentType };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key: string) {
    const file = this.resolve(key);
    await Promise.all([fs.rm(file, { force: true }), fs.rm(`${file}.type`, { force: true })]);
  }
}
