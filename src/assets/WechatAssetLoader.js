
const fs = wx.getFileSystemManager();

const CACHE_DIR =
  `${wx.env.USER_DATA_PATH}/three-model-cache`;

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

  await new Promise((resolve, reject) => {
    fs.mkdir({
      dirPath: CACHE_DIR,
      recursive: true,
      success: resolve,
      fail: reject
    });
  });
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

function downloadFile(url, onProgress) {
  return new Promise((resolve, reject) => {
    const task = wx.downloadFile({
      url,

      success(result) {
        if (result.statusCode !== 200) {
          reject(
            new Error(
              `Download HTTP ${result.statusCode}`
            )
          );
          return;
        }

        resolve(result.tempFilePath);
      },

      fail(error) {
        reject(error);
      }
    });

    if (
      task &&
      typeof task.onProgressUpdate === 'function'
    ) {
      task.onProgressUpdate((result) => {
        if (typeof onProgress === 'function') {
          onProgress({
            progress: result.progress,
            totalBytesWritten:
              result.totalBytesWritten,
            totalBytesExpectedToWrite:
              result.totalBytesExpectedToWrite
          });
        }
      });
    }
  });
}

export async function loadRemoteGLB(options) {
  const {
    url,
    cacheKey = 'model',
    version = 'v1',
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

  await ensureCacheDirectory();

  const cachePath =
    `${CACHE_DIR}/${cacheKey}-${version}.glb`;

  // 1. 优先读取当前版本缓存
  if (await exists(cachePath)) {
    try {
      const cached = await readFile(cachePath);

      validateGLB(cached);

      console.log(
        '[AssetLoader] Cache hit:',
        cachePath
      );

      onProgress?.({
        progress: 100,
        fromCache: true
      });

      return cached;
    } catch (error) {
      console.warn(
        '[AssetLoader] Invalid cache:',
        error
      );

      await removeFile(cachePath);
    }
  }

  // 2. 缓存不存在，下载远程资源
  console.log(
    '[AssetLoader] Download:',
    url
  );

  const tempPath = await downloadFile(
    url,
    onProgress
  );

  // 3. 读取并验证下载结果
  const buffer = await readFile(tempPath);

  validateGLB(buffer);

  console.log(
    '[AssetLoader] Download completed:',
    buffer.byteLength
  );

  // 4. 写入持久化缓存
  try {
    await copyFile(tempPath, cachePath);

    console.log(
      '[AssetLoader] Cache saved:',
      cachePath
    );
  } catch (error) {
    console.warn(
      '[AssetLoader] Cache save failed:',
      error
    );
  }

  return buffer;
}
