import assert from 'node:assert/strict'
import test from 'node:test'

import { projectQuarkAlignmentWorkspace } from '../src/components/quark-ingest/quark-alignment-workspace.ts'
import type {
  QuarkEpisodeAlignment,
  QuarkRenamePreview,
  QuarkSourceSelection,
} from '../src/types/quark-ingest.ts'

function file(fileId: string): QuarkRenamePreview {
  return {
    file_id: fileId,
    source_name: '150725_超清.mp4',
    target_name: '欢乐喜剧人 - 2015-07-25 - 超清.mp4',
    episode_number: null,
    status: 'UNRECOGNIZED',
    message: '请手动指定集数',
  }
}

function alignment(season: number, episode: number): QuarkEpisodeAlignment {
  return {
    season_number: season,
    episode_number: episode,
    air_date: '2015-06-06',
    episode_title: '第7期',
    files: [],
    status: 'MISSING',
    message: '分享中未找到对应文件',
  }
}

test('projects a dropped pending file into its TMDB episode immediately', () => {
  const pendingFile = file('file-1')
  const fileSources = new Map([
    ['file-1', { sourceCandidateId: 'source-1', file: pendingFile }],
  ])
  const selections: QuarkSourceSelection[] = [{
    source_candidate_id: 'source-1',
    season_number: 1,
    ignored: false,
    follow_updates: false,
    files: [{
      file_id: 'file-1',
      episode_number: 7,
      ignored: false,
      assignment_type: 'PRIMARY',
      forced: true,
    }],
  }]

  const projection = projectQuarkAlignmentWorkspace(
    [alignment(1, 7)],
    [{ sourceCandidateId: 'source-1', file: pendingFile }],
    fileSources,
    selections,
  )

  assert.deepEqual(
    projection.episodeAlignments[0].files.map((item) => item.file_id),
    ['file-1'],
  )
  assert.equal(projection.pendingFiles.length, 0)
  assert.equal(projection.episodeAlignments[0].status, 'MATCHED')
})

test('moves an aligned file to another TMDB episode without leaving a duplicate', () => {
  const alignedFile = file('file-1')
  const fileSources = new Map([
    ['file-1', { sourceCandidateId: 'source-1', file: alignedFile }],
  ])
  const sourceAlignment = {
    ...alignment(1, 7),
    files: [alignedFile],
    status: 'MATCHED' as const,
  }
  const selections: QuarkSourceSelection[] = [{
    source_candidate_id: 'source-1',
    season_number: 1,
    ignored: false,
    follow_updates: false,
    files: [{
      file_id: 'file-1',
      episode_number: 8,
      ignored: false,
      assignment_type: 'PRIMARY',
      forced: true,
    }],
  }]

  const projection = projectQuarkAlignmentWorkspace(
    [sourceAlignment, alignment(1, 8)],
    [],
    fileSources,
    selections,
  )

  assert.equal(projection.episodeAlignments[0].files.length, 0)
  assert.equal(projection.episodeAlignments[0].status, 'MISSING')
  assert.deepEqual(
    projection.episodeAlignments[1].files.map((item) => item.file_id),
    ['file-1'],
  )
  assert.equal(projection.episodeAlignments[1].status, 'MATCHED')
})
