/**
 * Chrome Storage Service
 * Wrapper around Chrome's storage API for easier usage
 */

export interface StorageData {
  targetLanguage: string
  blackList: string[]
  webTransEnabled: boolean
  selectionTransEnabled: boolean
  autoSpeak: boolean
}

const DEFAULT_SETTINGS: StorageData = {
  targetLanguage: 'zh',
  blackList: [],
  webTransEnabled: true,
  selectionTransEnabled: true,
  autoSpeak: false,
}

/**
 * Get a value from storage
 */
export async function get<K extends keyof StorageData>(
  key: K,
  defaultValue?: StorageData[K]
): Promise<StorageData[K]> {
  const result = await chrome.storage.sync.get(key)
  return result[key] ?? defaultValue ?? DEFAULT_SETTINGS[key]
}

/**
 * Get multiple values from storage
 */
export async function getMultiple<K extends keyof StorageData>(
  keys: K[]
): Promise<Pick<StorageData, K>> {
  const result = await chrome.storage.sync.get(keys)
  const data = {} as Pick<StorageData, K>

  for (const key of keys) {
    data[key] = result[key] ?? DEFAULT_SETTINGS[key]
  }

  return data
}

/**
 * Set a value in storage
 */
export async function set<K extends keyof StorageData>(
  key: K,
  value: StorageData[K]
): Promise<void> {
  await chrome.storage.sync.set({ [key]: value })
}

/**
 * Set multiple values in storage
 */
export async function setMultiple(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.sync.set(data)
}

/**
 * Remove a value from storage
 */
export async function remove(key: keyof StorageData): Promise<void> {
  await chrome.storage.sync.remove(key)
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<StorageData> {
  const result = await chrome.storage.sync.get(null)
  return { ...DEFAULT_SETTINGS, ...result }
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  await chrome.storage.sync.clear()
  await chrome.storage.sync.set(DEFAULT_SETTINGS)
}

/**
 * Add listener for storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      callback(changes)
    }
  })
}

export const Storage = {
  get,
  getMultiple,
  set,
  setMultiple,
  remove,
  getAllSettings,
  resetSettings,
  onStorageChange,
}

export default Storage
