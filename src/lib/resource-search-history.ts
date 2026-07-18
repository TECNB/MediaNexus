export type ResourceSearchHistoryCategory = 'movie' | 'tv' | 'anime'

export type ResourceSearchHistoryAnimeMode =
  | 'season-ingest'
  | 'follow-subscription'

export type ResourceSearchHistoryEntry = {
  keyword: string
  category: ResourceSearchHistoryCategory
  animeMode: ResourceSearchHistoryAnimeMode | null
  searchedAt: number
}

type AddResourceSearchHistoryInput = {
  keyword: string
  category: ResourceSearchHistoryCategory
  animeMode?: ResourceSearchHistoryAnimeMode | null
}

const RESOURCE_SEARCH_HISTORY_STORAGE_PREFIX =
  'medianexus.resource-search.history.v1'
const RESOURCE_SEARCH_HISTORY_LIMIT = 10

function isCategory(value: unknown): value is ResourceSearchHistoryCategory {
  return value === 'movie' || value === 'tv' || value === 'anime'
}

function isAnimeMode(
  value: unknown,
): value is ResourceSearchHistoryAnimeMode {
  return value === 'season-ingest' || value === 'follow-subscription'
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase()
}

function normalizeAnimeMode(
  category: ResourceSearchHistoryCategory,
  animeMode: ResourceSearchHistoryAnimeMode | null | undefined,
) {
  if (category !== 'anime') {
    return null
  }

  return animeMode ?? 'season-ingest'
}

function getStorageKey(userId: number) {
  return `${RESOURCE_SEARCH_HISTORY_STORAGE_PREFIX}.user.${userId}`
}

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getEntryIdentity(entry: {
  keyword: string
  category: ResourceSearchHistoryCategory
  animeMode?: ResourceSearchHistoryAnimeMode | null
}) {
  const animeMode = normalizeAnimeMode(entry.category, entry.animeMode)
  return JSON.stringify([
    entry.category,
    animeMode,
    normalizeKeyword(entry.keyword),
  ])
}

function parseEntry(value: unknown): ResourceSearchHistoryEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const keyword =
    typeof candidate.keyword === 'string' ? candidate.keyword.trim() : ''

  if (!keyword || !isCategory(candidate.category)) {
    return null
  }

  const animeMode =
    candidate.category === 'anime'
      ? isAnimeMode(candidate.animeMode)
        ? candidate.animeMode
        : 'season-ingest'
      : null
  const searchedAt =
    typeof candidate.searchedAt === 'number' &&
    Number.isFinite(candidate.searchedAt)
      ? candidate.searchedAt
      : 0

  return {
    keyword,
    category: candidate.category,
    animeMode,
    searchedAt,
  }
}

function sanitizeEntries(value: unknown): ResourceSearchHistoryEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const identities = new Set<string>()
  const entries: ResourceSearchHistoryEntry[] = []

  for (const valueEntry of value) {
    const entry = parseEntry(valueEntry)
    if (!entry) {
      continue
    }

    const identity = getEntryIdentity(entry)
    if (identities.has(identity)) {
      continue
    }

    identities.add(identity)
    entries.push(entry)

    if (entries.length === RESOURCE_SEARCH_HISTORY_LIMIT) {
      break
    }
  }

  return entries
}

function writeResourceSearchHistory(
  userId: number,
  entries: ResourceSearchHistoryEntry[],
) {
  const storage = getLocalStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(getStorageKey(userId), JSON.stringify(entries))
  } catch {
    // Keep the in-memory history usable when browser storage is unavailable.
  }
}

export function readResourceSearchHistory(userId: number) {
  const storage = getLocalStorage()
  if (!storage) {
    return []
  }

  try {
    const storedValue = storage.getItem(getStorageKey(userId))
    if (!storedValue) {
      return []
    }

    return sanitizeEntries(JSON.parse(storedValue))
  } catch {
    return []
  }
}

export function addResourceSearchHistory(
  userId: number,
  input: AddResourceSearchHistoryInput,
) {
  const keyword = input.keyword.trim()
  if (!keyword) {
    return readResourceSearchHistory(userId)
  }

  const entry: ResourceSearchHistoryEntry = {
    keyword,
    category: input.category,
    animeMode: normalizeAnimeMode(input.category, input.animeMode),
    searchedAt: Date.now(),
  }
  const identity = getEntryIdentity(entry)
  const nextEntries = [
    entry,
    ...readResourceSearchHistory(userId).filter(
      (currentEntry) => getEntryIdentity(currentEntry) !== identity,
    ),
  ].slice(0, RESOURCE_SEARCH_HISTORY_LIMIT)

  writeResourceSearchHistory(userId, nextEntries)
  return nextEntries
}

export function removeResourceSearchHistoryEntry(
  userId: number,
  entry: ResourceSearchHistoryEntry,
) {
  const identity = getEntryIdentity(entry)
  const nextEntries = readResourceSearchHistory(userId).filter(
    (currentEntry) => getEntryIdentity(currentEntry) !== identity,
  )

  writeResourceSearchHistory(userId, nextEntries)
  return nextEntries
}

export function clearResourceSearchHistory(userId: number) {
  const storage = getLocalStorage()
  if (storage) {
    try {
      storage.removeItem(getStorageKey(userId))
    } catch {
      // The caller still clears its in-memory history.
    }
  }

  return []
}

export function getResourceSearchHistoryEntryKey(
  entry: ResourceSearchHistoryEntry,
) {
  return getEntryIdentity(entry)
}
