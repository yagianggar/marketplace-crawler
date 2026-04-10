import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { info, error as logError } from './logger.js';

/**
 * Writes data to a JSON file, creating directories as needed.
 * @param {string} filePath - output file path
 * @param {*} data - data to serialize
 */
export async function writeJson(filePath, data) {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    info(`Saved ${Array.isArray(data) ? data.length : 1} items to ${filePath}`);
  } catch (err) {
    logError(`Failed to write output to ${filePath}: ${err.message}`);
    throw err;
  }
}
