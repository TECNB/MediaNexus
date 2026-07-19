export type EmbyLibrarySummary = {
  id: string
  name: string
}

export type EmbyLibraryListData = {
  items: EmbyLibrarySummary[]
}

export type EmbyLibraryRefreshResult = {
  libraryId: string
  libraryName: string
  message: string
}
