
const fs = wx.getFileSystemManager();

const CACHE_DIR =
  `${wx.env.USER_DATA_PATH}/three-model-cache`;
const invalidCacheEntries = new Set();

function exists(path) {
  return new Promise((resolve) => {
    fs.access({
      path,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

async function ensureCacheDirectory() {
  if (await exists(CACHE_DIR)) return;

  try {
    await new Promise((resolve, reject) => {
      fs.mkdir({
        dirPath: CACHE_DIR,
        recursive: true,
        success: resolve,
        fail: reject
      });
    });
  } catch (error) {
    if (!(await exists(CACHE_DIR))) throw error;
  }
}

function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath: path,
      success(result) {
        resolve(result.data);
      },
      fail: reject
    });
  });
}

function copyFile(source, destination) {
  return new Promise((resolve, reject) => {
    fs.copyFile({
      srcPath: source,
      destPath: destination,
      success: resolve,
      fail: reject
    });
  });
}

function removeFile(path) {
  invalidCacheEntries.add(path);
  return new Promise((resolve) => {
    fs.unlink({
      filePath: path,
      success: resolve,
      fail: resolve
    });
  });
}

function validateGLB(buffer) {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error('GLB must be an ArrayBuffer');
  }

  if (buffer.byteLength < 20) {
    throw new Error('GLB file is too small');
  }

  const view = new DataView(buffer);

  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);

  if (magic !== 0x46546c67) {
    throw new Error('Invalid GLB magic');
  }

  if (version !== 2) {
    throw new Error(
      `Unsupported GLB version: ${version}`
    );
  }

  if (length !== buffer.byteLength) {
    throw new Error(
      `GLB length mismatch: ${length} / ${buffer.byteLength}`
    );
  }

  return true;
}

/** @param {import('./ModelLoadAttempt').ModelLoadAttempt} attempt */
async function downloadFile(url, onProgress, attempt) {
  let unsubscribe = () => {};
  try {
    return await new Promise((resolve, reject) => {
      const task = wx.downloadFile({
        url,
        timeout: 30_000,

        success(result) {
          if (result.statusCode !== 200) {
            reject(new Error(`Download HTTP ${result.statusCode}`));
            return;
          }
          resolve(result.tempFilePath);
        },

        fail(error) {
          reject(new Error(error?.errMsg || 'Model download failed'));
        }
      });

      unsubscribe = attempt.onCancel((error) => {
        reject(error);
        task?.abort?.();
      });
      task?.onProgressUpdate?.((result) => {
        if (!attempt.cancelled) onProgress?.(result);
      });
    });
  } finally {
    unsubscribe();
  }
}

/**
 * @param {{
 *   url: string,
 *   cacheKey?: string,
 *   version?: string,
 *   attempt: import('./ModelLoadAttempt').ModelLoadAttempt,
 *   onProgress?: (info: {progress: number, fromCache?: boolean, totalBytesWritten?: number, totalBytesExpectedToWrite?: number}) => void
 * }} options
 * @returns {Promise<{buffer: ArrayBuffer, invalidate?: () => Promise<void>, save?: () => Promise<void>}>}
 */
export async function loadRemoteGLB(options) {
  const {
    url,
    cacheKey = 'model',
    version = 'v1',
    attempt,
    onProgress
  } = options;

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      'Resource URL must use HTTP or HTTPS'
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(cacheKey)) {
    throw new Error('Invalid cacheKey');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(version)) {
    throw new Error('Invalid version');
  }

  attempt.check();
  await ensureCacheDirectory();
  attempt.check();

  const cachePath =
    `${CACHE_DIR}/${cacheKey}-${version}.glb`;

  // 1. 优先读取当前版本缓存
  if (!invalidCacheEntries.has(cachePath) && await exists(cachePath)) {
    try {
      const cached = await readFile(cachePath);

      attempt.check();
      validateGLB(cached);

      console.log(
        '[AssetLoader] Cache hit:',
        cachePath
      );

      onProgress?.({
        progress: 100,
        fromCache: true
      });

      return { buffer: cached, invalidate: () => removeFile(cachePath) };
    } catch (error) {
      attempt.check();
      console.warn(
        '[AssetLoader] Invalid cache:',
        error
      );

      await removeFile(cachePath);
    }
  }

  attempt.check();
  // 2. 缓存不存在，下载远程资源
  console.log(
    '[AssetLoader] Download:',
    url
  );

  const tempPath = await downloadFile(
    url,
    onProgress,
    attempt
  );

  // 3. 读取并验证下载结果
  attempt.check();
  const buffer = await readFile(tempPath);
  attempt.check();

  validateGLB(buffer);

  console.log(
    '[AssetLoader] Download completed:',
    buffer.byteLength
  );

  return {
    buffer,
    // The GLTF parser must accept the contents before we persist this download.
    async save() {
      if (attempt.cancelled) return;
      try {
        await copyFile(tempPath, cachePath);
        invalidCacheEntries.delete(cachePath);
        console.log('[AssetLoader] Cache saved:', cachePath);
      } catch (error) {
        console.warn('[AssetLoader] Cache save failed:', error);
      }
    }
  };
}
