const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(path.resolve(__dirname, '..'));

function publishFiles(destination, stageParent, outputs, existing) {
  for (const file of outputs.keys()) {
    if (path.isAbsolute(file) || !path.resolve(destination, file).startsWith(destination + path.sep)) {
      throw new Error(`无效的产物路径 ${file}`);
    }
  }
  const stage = fs.mkdtempSync(path.join(stageParent, 'publish-'));
  const next = path.join(stage, 'next');
  const previous = path.join(stage, 'previous');
  const applied = [];
  let keepBackup = false;
  try {
    // 微信工具可能已打开输出目录。逐文件替换可以保留目录并支持 Windows 联调。
    for (const file of [...outputs.keys(), ...[...existing].filter(file => !outputs.has(file))]) {
      const output = path.join(destination, file);
      const bytes = outputs.get(file);
      if (existing.has(file)) {
        const original = fs.readFileSync(output);
        if (bytes?.equals(original)) continue;
        const backup = path.join(previous, file);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.writeFileSync(backup, original);
      }
      if (bytes) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(next, bytes);
        fs.renameSync(next, output);
      } else {
        fs.unlinkSync(output);
      }
      applied.push(file);
    }
  } catch (error) {
    let restoreError;
    for (const file of applied.reverse()) {
      const output = path.join(destination, file);
      try {
        if (existing.has(file)) fs.renameSync(path.join(previous, file), output);
        else fs.unlinkSync(output);
      } catch (failure) {
        restoreError ??= failure;
      }
    }
    if (restoreError) {
      keepBackup = true;
      throw new Error(`恢复上一份产物失败，备份位于 ${previous}。${restoreError.message}`, { cause: error });
    }
    throw error;
  } finally {
    if (!keepBackup) fs.rmSync(stage, { recursive: true, force: true, maxRetries: 2 });
  }
}

function outputEntries(directory) {
  const entries = fs.readdirSync(directory, { recursive: true, withFileTypes: true });
  if (entries.some(entry => !entry.isFile() && !entry.isDirectory())) {
    throw new Error(`产物目录仅支持常规文件和目录 ${directory}`);
  }
  return entries;
}

function pruneEmptyDirectories(entries) {
  const dirs = entries.filter(entry => entry.isDirectory()).map(entry => path.join(entry.parentPath, entry.name));
  for (const dir of dirs.sort((a, b) => b.length - a.length)) {
    try {
      fs.rmdirSync(dir);
    } catch (error) {
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(error.code)) throw error;
    }
  }
}

function writeRelease(name, platform, files) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) || !['web', 'wechat', 'wechat-remote'].includes(platform)) {
    throw new Error('无效的 App ID 或产物平台。');
  }
  let parent = root;
  for (const segment of ['.build', 'releases', name]) {
    parent = path.join(parent, segment);
    fs.mkdirSync(parent, { recursive: true });
    if (fs.realpathSync(parent) !== parent) throw new Error(`产物目录须位于当前仓库 ${parent}`);
  }
  const destination = path.join(parent, platform);
  const lock = path.join(parent, `.${platform}.lock`);
  fs.mkdirSync(lock);
  try {
    fs.mkdirSync(destination, { recursive: true });
    if (fs.realpathSync(destination) !== destination) throw new Error(`产物位置须为常规目录 ${destination}`);
    const entries = outputEntries(destination);
    const existing = new Set(entries.filter(entry => entry.isFile())
      .map(entry => path.relative(destination, path.join(entry.parentPath, entry.name))));
    publishFiles(destination, parent, files, existing);
    pruneEmptyDirectories(entries);
    return destination;
  } finally {
    fs.rmdirSync(lock);
  }
}

module.exports = { writeRelease, publishFiles, outputEntries, pruneEmptyDirectories };
