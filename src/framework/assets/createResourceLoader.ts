import { loadPackagedImage } from './loadPackagedImage';

export type ResourceSource =
  | { kind: 'package'; root: string }
  | { kind: 'subpackage'; name: string; root: string }
  | { kind: 'remote'; baseUrl: string };

const mountedSubpackages = new Map<string, Promise<void>>();
const maxDownloads = 4;

function remember<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let pending = cache.get(key);
  if (!pending) {
    pending = load().catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, pending);
  }
  return pending;
}

function mount(name: string) {
  return remember(mountedSubpackages, name, () => new Promise<void>((resolve, reject) => {
    wx.loadSubpackage({
      name,
      success: () => resolve(),
      fail: ({ errMsg }) => reject(new Error(`Cannot load subpackage ${name}: ${errMsg}`)),
      complete() {}
    });
  }));
}

function readBinaryFile(path: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: path,
      success({ data }) {
        if (typeof data === 'string') reject(new Error(`Expected binary resource: ${path}`));
        else resolve(data);
      },
      fail: ({ errMsg }) => reject(new Error(`Cannot read resource ${path}: ${errMsg}`))
    });
  });
}

export function createResourceLoader(source: ResourceSource) {
  const base = (source.kind === 'remote' ? source.baseUrl : source.root).replace(/\/+$/, '') + '/';
  const downloads = new Map<string, Promise<string>>();
  const queue: (() => void)[] = [];
  let activeDownloads = 0;

  async function download(file: string, segments: string[]) {
    if (activeDownloads >= maxDownloads) await new Promise<void>(resolve => queue.push(resolve));
    else activeDownloads++;
    try {
      return await new Promise<string>((resolve, reject) => {
        wx.downloadFile({
          url: base + segments.map(encodeURIComponent).join('/'),
          timeout: 30_000,
          success({ statusCode, tempFilePath }) {
            if (statusCode === 200 && tempFilePath) resolve(tempFilePath);
            else reject(new Error(`Resource download failed for ${file}: HTTP ${statusCode}`));
          },
          fail: ({ errMsg }) => reject(new Error(`Cannot download resource ${file}: ${errMsg}`))
        });
      });
    } finally {
      const next = queue.shift();
      if (next) next();
      else activeDownloads--;
    }
  }

  async function load<T>(file: string, read: (path: string) => Promise<T>) {
    const segments = file.split('/');
    if (/[\\:?#]/.test(file) || segments.some(segment => !segment || segment === '.' || segment === '..')) {
      throw new Error(`Invalid resource path: ${file}`);
    }

    if (source.kind === 'remote') {
      const pending = remember(downloads, file, () => download(file, segments));
      try {
        return await read(await pending);
      } catch (error) {
        // A stale or unreadable temporary file can be downloaded again on the next attempt.
        if (downloads.get(file) === pending) downloads.delete(file);
        throw error;
      }
    }
    if (source.kind === 'subpackage') await mount(source.name);
    return read(base + file);
  }

  return {
    loadImage: (file: string) => load(file, loadPackagedImage),
    readBinary: (file: string) => load(file, readBinaryFile)
  };
}
