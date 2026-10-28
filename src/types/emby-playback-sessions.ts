export type EmbyPlaybackSession = {
  id: string
  userId: string | null
  userName: string | null
  client: string | null
  deviceName: string | null
  paused: boolean | null
  itemId: string
  type: string
  title: string | null
  seriesName: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  episodeNumberEnd: number | null
  positionSeconds: number | null
  durationSeconds: number | null
  posters: { itemId: string; imageTag: string | null }[]
}

export type EmbyPlaybackSnapshot = {
  collectedAt: string
  sessions: EmbyPlaybackSession[]
}
