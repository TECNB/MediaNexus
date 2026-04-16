import { useCallback, useEffect, useRef, useState } from 'react'

import { PageContainer } from '@/components/layout/page-container'
import {
  CategorySwitch,
  type ResourceCategoryValue,
} from '@/components/resources/category-switch'
import {
  MediaCard,
  type MediaCardAddStatus,
} from '@/components/resources/media-card'
import { SearchBar } from '@/components/resources/search-bar'
import {
  addMovieResource,
  getMovieQualityProfiles,
  isRequestCanceledError,
  searchMovies,
  searchSeries,
} from '@/lib/api/resources'
import type {
  MovieQualityProfile,
  MovieSearchItem,
  SearchableResourceItem,
} from '@/types/resources'

type SearchableCategory = Extract<ResourceCategoryValue, 'movie' | 'tv'>

type ResourceSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'
type MovieQualityProfilesStatus = 'idle' | 'loading' | 'success' | 'error'

type ResourceSearchState = {
  status: ResourceSearchStatus
  items: SearchableResourceItem[]
  errorMessage: string | null
}

type MovieAddState = {
  status: MediaCardAddStatus
  message: string | null
}

const searchableCategoryCopy: Record<
  SearchableCategory,
  {
    placeholder: string
    idleTitle: string
    idleDescription: string
    loadingTitle: string
    loadingDescription: string
    emptyTitle: string
    emptyDescription: string
    errorMessage: string
  }
> = {
  movie: {
    placeholder: '搜索电影名称…',
    idleTitle: '输入电影名称开始搜索',
    idleDescription: '当前分类会调用电影搜索接口。',
    loadingTitle: '正在搜索电影…',
    loadingDescription: '已连接后端接口，正在获取最新搜索结果。',
    emptyTitle: '没有搜索结果',
    emptyDescription: '换个电影名称试试，或检查关键词是否输入正确。',
    errorMessage: '电影搜索失败，请稍后重试。',
  },
  tv: {
    placeholder: '搜索电视剧名称…',
    idleTitle: '输入电视剧名称开始搜索',
    idleDescription: '当前分类会调用电视剧搜索接口。',
    loadingTitle: '正在搜索电视剧…',
    loadingDescription: '已连接后端接口，正在获取最新搜索结果。',
    emptyTitle: '没有搜索结果',
    emptyDescription: '换个电视剧名称试试，或检查关键词是否输入正确。',
    errorMessage: '电视剧搜索失败，请稍后重试。',
  },
}

const unsupportedCategoryCopy = {
  anime: {
    title: '动漫搜索暂未接入',
    description: '当前仅保留动漫分类占位提示，本轮不会发起真实搜索请求。',
  },
} satisfies Record<'anime', { title: string; description: string }>

const categorySearchHandlers: Record<
  SearchableCategory,
  (term: string, signal?: AbortSignal) => Promise<SearchableResourceItem[]>
> = {
  movie: async (term, signal) => searchMovies(term, signal),
  tv: async (term, signal) => searchSeries(term, signal),
}

function isSearchableCategory(
  category: ResourceCategoryValue,
): category is SearchableCategory {
  return category === 'movie' || category === 'tv'
}

function isMovieSearchItem(
  item: SearchableResourceItem,
): item is MovieSearchItem {
  return !('tvdb_id' in item)
}

function getMovieAddKey(item: MovieSearchItem) {
  return typeof item.tmdb_id === 'number' && item.tmdb_id > 0
    ? `tmdb:${item.tmdb_id}`
    : `id:${item.id}`
}

function getDefaultMovieQualityProfileId(profiles: MovieQualityProfile[]) {
  return profiles.find((profile) => profile.is_default)?.id ?? profiles[0]?.id
}

function createInitialSearchState(): ResourceSearchState {
  return {
    status: 'idle',
    items: [],
    errorMessage: null,
  }
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-8 py-14 text-center">
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function ResourceSearchPage() {
  const [category, setCategory] = useState<ResourceCategoryValue>('movie')
  const [searchText, setSearchText] = useState('')
  const [searchState, setSearchState] = useState<ResourceSearchState>(
    createInitialSearchState,
  )
  const [movieAddStates, setMovieAddStates] = useState<
    Record<string, MovieAddState>
  >({})
  const [movieQualityProfiles, setMovieQualityProfiles] = useState<
    MovieQualityProfile[]
  >([])
  const [movieQualityProfilesStatus, setMovieQualityProfilesStatus] =
    useState<MovieQualityProfilesStatus>('idle')
  const [movieQualityProfilesMessage, setMovieQualityProfilesMessage] =
    useState<string | null>(null)
  const [movieQualitySelections, setMovieQualitySelections] = useState<
    Record<string, number>
  >({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const latestRequestIdRef = useRef(0)
  const activeRequestControllerRef = useRef<AbortController | null>(null)
  const activeMovieAddKeysRef = useRef<Set<string>>(new Set())
  const movieQualityProfilesStatusRef =
    useRef<MovieQualityProfilesStatus>('idle')
  const movieQualityProfilesRequestIdRef = useRef(0)
  const movieQualityProfilesControllerRef = useRef<AbortController | null>(
    null,
  )

  const loadMovieQualityProfiles = useCallback((force = false) => {
    if (
      !force &&
      (movieQualityProfilesStatusRef.current === 'loading' ||
        movieQualityProfilesStatusRef.current === 'success')
    ) {
      return
    }

    movieQualityProfilesRequestIdRef.current += 1
    const requestId = movieQualityProfilesRequestIdRef.current
    const controller = new AbortController()

    movieQualityProfilesControllerRef.current?.abort()
    movieQualityProfilesControllerRef.current = controller
    movieQualityProfilesStatusRef.current = 'loading'
    setMovieQualityProfilesStatus('loading')
    setMovieQualityProfilesMessage(null)

    void getMovieQualityProfiles(controller.signal)
      .then((items) => {
        if (movieQualityProfilesRequestIdRef.current !== requestId) {
          return
        }

        if (items.length === 0) {
          movieQualityProfilesStatusRef.current = 'error'
          setMovieQualityProfiles([])
          setMovieQualityProfilesStatus('error')
          setMovieQualityProfilesMessage('未获取到可用质量档位，请稍后重试。')
          return
        }

        movieQualityProfilesStatusRef.current = 'success'
        setMovieQualityProfiles(items)
        setMovieQualityProfilesStatus('success')
        setMovieQualityProfilesMessage(null)
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (movieQualityProfilesRequestIdRef.current !== requestId) {
          return
        }

        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '质量档位加载失败，请稍后重试。'

        movieQualityProfilesStatusRef.current = 'error'
        setMovieQualityProfiles([])
        setMovieQualityProfilesStatus('error')
        setMovieQualityProfilesMessage(message)
      })
      .finally(() => {
        if (movieQualityProfilesControllerRef.current === controller) {
          movieQualityProfilesControllerRef.current = null
        }
      })
  }, [])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toastMessage])

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort()
      movieQualityProfilesControllerRef.current?.abort()
      movieQualityProfilesControllerRef.current = null

      if (movieQualityProfilesStatusRef.current === 'loading') {
        movieQualityProfilesStatusRef.current = 'idle'
      }
    }
  }, [])

  useEffect(() => {
    latestRequestIdRef.current += 1
    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null
    activeMovieAddKeysRef.current.clear()
    setSearchState(createInitialSearchState())
    setMovieAddStates({})
    setMovieQualitySelections({})
  }, [category])

  useEffect(() => {
    if (category !== 'movie') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      loadMovieQualityProfiles()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [category, loadMovieQualityProfiles])

  const isCategorySearchable = isSearchableCategory(category)
  const activeCategoryCopy = isCategorySearchable
    ? searchableCategoryCopy[category]
    : null
  const isSearching = isCategorySearchable && searchState.status === 'loading'
  const isSearchSubmitDisabled = !isCategorySearchable || isSearching
  const activeSearchPlaceholder = activeCategoryCopy?.placeholder ?? '动漫搜索暂未接入'
  const defaultMovieQualityProfileId =
    getDefaultMovieQualityProfileId(movieQualityProfiles)

  function handleSearchSubmit() {
    if (!isSearchableCategory(category) || searchState.status === 'loading') {
      return
    }

    const activeCategory = category
    const activeSearchHandler = categorySearchHandlers[activeCategory]
    const activeCopy = searchableCategoryCopy[activeCategory]
    const keyword = searchText.trim()
    latestRequestIdRef.current += 1
    const requestId = latestRequestIdRef.current

    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null

    if (!keyword) {
      activeMovieAddKeysRef.current.clear()
      setSearchState(createInitialSearchState())
      setMovieAddStates({})
      setMovieQualitySelections({})
      return
    }

    const controller = new AbortController()
    activeRequestControllerRef.current = controller

    activeMovieAddKeysRef.current.clear()
    setMovieAddStates({})
    setMovieQualitySelections({})
    setSearchState({
      status: 'loading',
      items: [],
      errorMessage: null,
    })

    void activeSearchHandler(keyword, controller.signal)
      .then((items) => {
        if (latestRequestIdRef.current !== requestId) {
          return
        }

        setSearchState({
          status: items.length > 0 ? 'success' : 'empty',
          items,
          errorMessage: null,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted || isRequestCanceledError(error)) {
          return
        }

        if (latestRequestIdRef.current !== requestId) {
          return
        }

        console.error(`${activeCategory} search failed`, error)

        setSearchState({
          status: 'error',
          items: [],
          errorMessage: activeCopy.errorMessage,
        })
      })
      .finally(() => {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null
        }
      })
  }

  function getSelectedMovieQualityProfileId(item: MovieSearchItem) {
    const selectedQualityProfileId = movieQualitySelections[getMovieAddKey(item)]

    if (
      typeof selectedQualityProfileId === 'number' &&
      movieQualityProfiles.some(
        (profile) => profile.id === selectedQualityProfileId,
      )
    ) {
      return selectedQualityProfileId
    }

    return defaultMovieQualityProfileId
  }

  function handleMovieQualityProfileChange(
    item: MovieSearchItem,
    qualityProfileId: number,
  ) {
    setMovieQualitySelections((currentSelections) => ({
      ...currentSelections,
      [getMovieAddKey(item)]: qualityProfileId,
    }))
  }

  function handleMovieAdd(
    item: MovieSearchItem,
    qualityProfileId: number,
  ) {
    const itemKey = getMovieAddKey(item)
    const currentAddState = movieAddStates[itemKey]

    if (
      activeMovieAddKeysRef.current.has(itemKey) ||
      currentAddState?.status === 'loading' ||
      currentAddState?.status === 'success'
    ) {
      return
    }

    if (
      movieQualityProfilesStatus !== 'success' ||
      !movieQualityProfiles.some((profile) => profile.id === qualityProfileId)
    ) {
      const message =
        movieQualityProfilesMessage ?? '质量档位未加载完成，请稍后重试。'

      setMovieAddStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'error',
          message,
        },
      }))
      setToastMessage(message)
      return
    }

    if (typeof item.tmdb_id !== 'number' || item.tmdb_id <= 0) {
      const message = '该电影缺少必要标识，暂时无法添加。'

      setMovieAddStates((currentStates) => ({
        ...currentStates,
        [itemKey]: {
          status: 'error',
          message,
        },
      }))
      setToastMessage(message)
      return
    }

    activeMovieAddKeysRef.current.add(itemKey)
    setMovieAddStates((currentStates) => ({
      ...currentStates,
      [itemKey]: {
        status: 'loading',
        message: '正在发起搜索…',
      },
    }))

    void addMovieResource({
      tmdb_id: item.tmdb_id,
      title: item.title,
      year: item.year,
      qualityProfileId,
    })
      .then(() => {
        const message = '已开始搜索'

        setMovieAddStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'success',
            message,
          },
        }))
        setToastMessage(message)
      })
      .catch((error) => {
        activeMovieAddKeysRef.current.delete(itemKey)
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : '搜索发起失败，请稍后重试。'

        setMovieAddStates((currentStates) => ({
          ...currentStates,
          [itemKey]: {
            status: 'error',
            message,
          },
        }))
        setToastMessage(message)
      })
  }

  function renderMovieQualityProfilesNotice() {
    if (category !== 'movie') {
      return null
    }

    if (movieQualityProfilesStatus === 'loading') {
      return (
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-500">
          正在加载质量档位…
        </div>
      )
    }

    if (movieQualityProfilesStatus !== 'error') {
      return null
    }

    return (
      <div
        role="alert"
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="font-medium">
          {movieQualityProfilesMessage ?? '质量档位加载失败，请稍后重试。'}
        </span>
        <button
          type="button"
          onClick={() => loadMovieQualityProfiles(true)}
          className="h-8 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
        >
          重新加载
        </button>
      </div>
    )
  }

  function renderSearchContent() {
    if (!activeCategoryCopy) {
      return (
        <EmptyState
          title={unsupportedCategoryCopy.anime.title}
          description={unsupportedCategoryCopy.anime.description}
        />
      )
    }

    switch (searchState.status) {
      case 'loading':
        return (
          <EmptyState
            title={activeCategoryCopy.loadingTitle}
            description={activeCategoryCopy.loadingDescription}
          />
        )

      case 'error':
        return (
          <EmptyState
            title="搜索失败"
            description={searchState.errorMessage ?? activeCategoryCopy.errorMessage}
          />
        )

      case 'empty':
        return (
          <EmptyState
            title={activeCategoryCopy.emptyTitle}
            description={activeCategoryCopy.emptyDescription}
          />
        )

      case 'success':
        return (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {searchState.items.map((item) => {
              const movieAddState = isMovieSearchItem(item)
                ? movieAddStates[getMovieAddKey(item)]
                : null
              const selectedMovieQualityProfileId = isMovieSearchItem(item)
                ? getSelectedMovieQualityProfileId(item)
                : undefined

              return (
                <MediaCard
                  key={item.id}
                  item={item}
                  addStatus={movieAddState?.status}
                  addMessage={movieAddState?.message}
                  qualityProfiles={
                    isMovieSearchItem(item) ? movieQualityProfiles : undefined
                  }
                  selectedQualityProfileId={selectedMovieQualityProfileId}
                  onQualityProfileChange={
                    isMovieSearchItem(item)
                      ? handleMovieQualityProfileChange
                      : undefined
                  }
                  onAddMovie={
                    isMovieSearchItem(item) ? handleMovieAdd : undefined
                  }
                />
              )
            })}
          </div>
        )

      case 'idle':
      default:
        return (
          <EmptyState
            title={activeCategoryCopy.idleTitle}
            description={activeCategoryCopy.idleDescription}
          />
        )
    }
  }

  return (
    <PageContainer
      title="资源搜索"
      description="电影与电视剧分类支持按回车或点击搜索按钮发起真实搜索，动漫分类暂时保留占位提示。"
    >
      <div className="space-y-10">
        <div className="flex flex-col items-center gap-6">
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            onSubmit={handleSearchSubmit}
            placeholder={activeSearchPlaceholder}
            isSubmitting={isSearching}
            submitDisabled={isSearchSubmitDisabled}
          />
          <CategorySwitch value={category} onChange={setCategory} />
        </div>

        {renderMovieQualityProfilesNotice()}

        {renderSearchContent()}
      </div>

      {toastMessage ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 right-6 z-20"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)]">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
