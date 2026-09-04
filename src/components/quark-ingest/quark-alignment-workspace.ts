import type {
  QuarkEpisodeAlignment,
  QuarkRenamePreview,
  QuarkSourceSelection,
} from '../../types/quark-ingest.ts'

export type QuarkAlignmentFileSource = {
  sourceCandidateId: string
  file: QuarkRenamePreview
}

export type QuarkPendingAlignmentFile = QuarkAlignmentFileSource

export type QuarkAlignmentWorkspaceProjection = {
  episodeAlignments: QuarkEpisodeAlignment[]
  pendingFiles: QuarkPendingAlignmentFile[]
}

const PENDING_EPISODE_PATTERNS = [
  /(?:^|[^a-z0-9])s\d{1,2}[ ._-]*e(\d{1,3})(?=$|[^0-9])/i,
  /(?:^|[^a-z0-9])(?:ep|e)[ ._-]*(\d{1,3})(?=$|[ ._-])/i,
  /(?:^|[^\d])第\s*(\d{1,3})\s*[集话期]/,
  /(?:^|[^\d])(\d{1,3})\s*[集话期](?=$|[^\d])/,
]
const PENDING_DATE_PATTERN = /(?<!\d)(20\d{2})[ ._-]?(\d{2})[ ._-]?(\d{2})(?!\d)/
const PENDING_SHORT_DATE_PATTERN = /(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/
const PENDING_FILE_COLLATOR = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
})

function pendingFileSortKey(name: string): [number, number, number, string] {
  const episode = PENDING_EPISODE_PATTERNS
    .map((pattern) => pattern.exec(name)?.[1])
    .find((value) => value != null)
  const episodeNumber = episode == null ? null : Number(episode)
  const dateMatch = PENDING_DATE_PATTERN.exec(name)
  const shortDateMatch = PENDING_SHORT_DATE_PATTERN.exec(name)
  const dateNumber = dateMatch
    ? Number(dateMatch[1] + dateMatch[2] + dateMatch[3])
    : shortDateMatch
      ? Number('20' + shortDateMatch[1] + shortDateMatch[2] + shortDateMatch[3])
      : Number.MAX_SAFE_INTEGER
  if (episodeNumber != null && episodeNumber > 0) {
    return [0, episodeNumber, dateNumber, name]
  }
  if (dateNumber !== Number.MAX_SAFE_INTEGER) {
    return [1, dateNumber, Number.MAX_SAFE_INTEGER, name]
  }
  return [2, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, name]
}

/** Extract the Chinese variety episode marker (e.g. 第3期/第4集). */
export function parseVarietyEpisodeNumber(name: string): number | null {
  const match = /(?:^|[^\d])第\s*(\d{1,3})\s*[期集话](?=$|[^\d])/i.exec(name)
  if (!match) return null
  const episode = Number(match[1])
  return episode > 0 && episode <= 999 ? episode : null
}

function compareQuarkFileNames(
  leftName: string,
  rightName: string,
  leftId: string,
  rightId: string,
) {
  const leftKey = pendingFileSortKey(leftName)
  const rightKey = pendingFileSortKey(rightName)
  for (let index = 0; index < leftKey.length - 1; index += 1) {
    if (leftKey[index] !== rightKey[index]) {
      return Number(leftKey[index]) - Number(rightKey[index])
    }
  }
  const nameOrder = PENDING_FILE_COLLATOR.compare(leftKey[3], rightKey[3])
  return nameOrder !== 0 ? nameOrder : leftId.localeCompare(rightId)
}

export function sortQuarkPendingFiles(files: QuarkPendingAlignmentFile[]) {
  return [...files].sort((left, right) => compareQuarkFileNames(
    left.file.source_name,
    right.file.source_name,
    left.file.file_id,
    right.file.file_id,
  ))
}

export function sortQuarkRenamePreviews(files: QuarkRenamePreview[]) {
  return [...files].sort((left, right) => compareQuarkFileNames(
    left.source_name,
    right.source_name,
    left.file_id,
    right.file_id,
  ))
}

export function clearQuarkFileAlignment(
  selections: QuarkSourceSelection[],
  sourceCandidateId: string,
  fileId: string,
  originalSeason: number | null | undefined,
): QuarkSourceSelection[] {
  return selections.map((selection) => selection.source_candidate_id === sourceCandidateId
    ? {
        ...selection,
        season_number: originalSeason ?? selection.season_number,
        files: selection.files.filter((file) => file.file_id !== fileId),
      }
    : selection)
}

export function projectQuarkAlignmentWorkspace(
  episodeAlignments: QuarkEpisodeAlignment[],
  pendingFiles: QuarkPendingAlignmentFile[],
  fileSources: Map<string, QuarkAlignmentFileSource>,
  selections: QuarkSourceSelection[],
  detachedFileIds: Set<string> = new Set(),
): QuarkAlignmentWorkspaceProjection {
  const selectionsById = new Map(
    selections.map((selection) => [selection.source_candidate_id, selection]),
  )
  const correctionsByFileId = new Map(selections.flatMap((selection) =>
    selection.files.map((correction) => [correction.file_id, {
      selection,
      correction,
    }] as const)),
  )

  const projectedAlignments = episodeAlignments.map((alignment) => {
    const filesById = new Map<string, QuarkRenamePreview>()
    for (const file of alignment.files) {
      const source = fileSources.get(file.file_id)
      const sourceSelection = source
        ? selectionsById.get(source.sourceCandidateId)
        : null
      const local = correctionsByFileId.get(file.file_id)
      if (detachedFileIds.has(file.file_id)
        || sourceSelection?.ignored
        || local?.correction.ignored
        || local?.correction.episode_number != null) {
        continue
      }
      filesById.set(file.file_id, file)
    }

    for (const selection of selections) {
      if (selection.ignored || selection.season_number !== alignment.season_number) continue
      for (const correction of selection.files) {
        if (detachedFileIds.has(correction.file_id)
          || correction.ignored
          || correction.episode_number !== alignment.episode_number) continue
        const source = fileSources.get(correction.file_id)
        if (!source) continue
        filesById.set(correction.file_id, {
          ...source.file,
          episode_number: correction.episode_number,
          status: 'MANUAL',
          message: '已映射到该 TMDB 集数，重新生成预览后确认最终文件名',
          assignment_type: correction.assignment_type ?? source.file.assignment_type,
          edition_label: correction.edition_label ?? source.file.edition_label,
          segment_label: correction.segment_label ?? source.file.segment_label,
          forced: correction.forced ?? true,
        })
      }
    }

    const files = [...filesById.values()]
    return {
      ...alignment,
      files,
      status: files.length === 0 ? 'MISSING' : files.length > 1 ? 'MULTIPLE' : 'MATCHED',
      message: files.length === 0
        ? alignment.message
        : files.length > 1
          ? '多个源文件映射到此集，请确认版本或分段'
          : null,
    }
  })

  const projectedPendingFiles = new Map<string, QuarkPendingAlignmentFile>()
  for (const pending of pendingFiles) {
    const selection = selectionsById.get(pending.sourceCandidateId)
    const correction = correctionsByFileId.get(pending.file.file_id)?.correction
    if (!selection?.ignored
      && !correction?.ignored
      && (detachedFileIds.has(pending.file.file_id) || correction?.episode_number == null)) {
      projectedPendingFiles.set(pending.file.file_id, pending)
    }
  }
  for (const fileId of detachedFileIds) {
    const source = fileSources.get(fileId)
    if (!source) continue
    const selection = selectionsById.get(source.sourceCandidateId)
    const correction = correctionsByFileId.get(fileId)?.correction
    if (!selection?.ignored && !correction?.ignored) {
      projectedPendingFiles.set(fileId, source)
    }
  }

  return {
    episodeAlignments: projectedAlignments,
    pendingFiles: [...projectedPendingFiles.values()],
  }
}
