import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearQuarkFileAlignment,
  projectQuarkAlignmentWorkspace,
} from '../src/components/quark-ingest/quark-alignment-workspace.ts'
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

test('clears a manual mapping when the file is dropped back into pending', () => {
  const pendingFile = file('file-1')
  const selections: QuarkSourceSelection[] = [{
    source_candidate_id: 'source-1',
    season_number: 2,
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

  const cleared = clearQuarkFileAlignment(selections, 'source-1', 'file-1', 1)
  const projection = projectQuarkAlignmentWorkspace(
    [alignment(1, 7)],
    [{ sourceCandidateId: 'source-1', file: pendingFile }],
    new Map([['file-1', { sourceCandidateId: 'source-1', file: pendingFile }]]),
    cleared,
  )

  assert.equal(cleared[0].season_number, 1)
  assert.deepEqual(cleared[0].files, [])
  assert.deepEqual(
    projection.pendingFiles.map((pending) => pending.file.file_id),
    ['file-1'],
  )
})

test('projects an automatically aligned file back into pending when detached', () => {
  const automaticFile = {
    ...file('file-1'),
    source_name: '.EP06.2019.1080p.mp4',
    target_name: '欢乐喜剧人 - S05E06 - 1080p.mp4',
    episode_number: 6,
    status: 'READY',
  }
  const automaticAlignment = {
    ...alignment(5, 6),
    files: [automaticFile],
    status: 'MATCHED' as const,
  }
  const selections: QuarkSourceSelection[] = [{
    source_candidate_id: 'source-1',
    season_number: 5,
    ignored: false,
    follow_updates: false,
    files: [],
  }]

  const projection = projectQuarkAlignmentWorkspace(
    [automaticAlignment],
    [],
    new Map([['file-1', { sourceCandidateId: 'source-1', file: automaticFile }]]),
    selections,
    new Set(['file-1']),
  )

  assert.equal(projection.episodeAlignments[0].files.length, 0)
  assert.deepEqual(
    projection.pendingFiles.map((pending) => pending.file.file_id),
    ['file-1'],
  )
})
