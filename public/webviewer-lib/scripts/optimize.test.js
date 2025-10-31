const test = require('node:test');
const assert = require('node:assert');
const {
  writeChunkFile,
  extractFileName,
  logChunkFilePaths,
  createChunkDirectory
} = require('./optimize-for-prod');
const fs = require('fs-extra');

// Test file to test optimize-for-prod.js
// Currently circle ci and manually tested node --test
const originalConsoleLog = console.log;
const consoleOutput = [];
const mockedLog = output => consoleOutput.push(output);
console.log = mockedLog;

test('logChunkFilePaths', () => {
  const chunkFilePaths = ['path/to/chunk1', 'path/to/chunk2', 'path/to/chunk3'];
  const numChunks = 3;

  logChunkFilePaths(chunkFilePaths, numChunks);

  // Restore console.log
  console.log = originalConsoleLog;

  // Check the captured output
  assert.strictEqual(consoleOutput[0], '\n\x1B[32mFile split successfully into 3 chunks:\x1B[0m');
  chunkFilePaths.forEach((chunkFilePath, index) => {
    assert.strictEqual(consoleOutput[index + 1], `\x1B[32mChunk ${index + 1}:\x1B[0m ${chunkFilePath}`);
  });
});

test('extractFileName', () => {
  const path = 'static/release-files/scripts/optimize.br.wasm';
  const result = extractFileName(path);
  assert.strictEqual(result, 'optimize');
});

test('writeChunkFile throws an error when fs.writeFileSync fails', () => {
  const chunkFilePath = 'test-chunk-file.txt';
  const chunkContent = 'This is a test chunk';

  const errorMessage = 'Mock write error';
  fs.writeFileSync = () => {
    throw new Error(errorMessage);
  };

  assert.throws(
    () => writeChunkFile(chunkFilePath, chunkContent),
    new Error(`Failed to write chunk file: ${chunkFilePath}`)
  );
});

test('writeChunkFile writes the correct content to the file', () => {
  const chunkFilePath = 'test-chunk-file.txt';
  const chunkContent = 'This is a test chunk';

  const writeFileSyncMock = (filePath, content) => {
    assert.strictEqual(filePath, chunkFilePath);
    assert.strictEqual(content, chunkContent);
  };
  fs.writeFileSync = writeFileSyncMock;

  writeChunkFile(chunkFilePath, chunkContent);
});

test('createChunkDirectory throws an error when fs.mkdirSync fails', () => {
  const chunkDir = 'test-chunk-dir';
  const errorMessage = 'Mock mkdir error';

  fs.mkdirSync = () => {
    throw new Error(errorMessage);
  };

  assert.throws(
    () => createChunkDirectory(chunkDir),
    new Error(`Failed to create directory: ${chunkDir}`)
  );
});

test('createChunkDirectory creates the directory successfully', () => {
  const chunkDir = 'test-chunk-dir';

  const mkdirSyncMock = (dir) => {
    assert.strictEqual(dir, chunkDir);
  };
  fs.mkdirSync = mkdirSyncMock;

  createChunkDirectory(chunkDir);
});