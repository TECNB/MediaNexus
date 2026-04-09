import { useEffect, useRef, useState } from 'react'

import { PageContainer } from '@/components/layout/page-container'
import {
  CategorySwitch,
  type ResourceCategoryValue,
} from '@/components/resources/category-switch'
import { MediaCard } from '@/components/resources/media-card'
import { SearchBar } from '@/components/resources/search-bar'
import {
  isRequestCanceledError,
  searchMovies,
} from '@/lib/api/resources'
import type { MovieSearchItem } from '@/types/resources'

type MovieSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

type MovieSearchState = {
  status: MovieSearchStatus
  items: MovieSearchItem[]
  errorMessage: string | null
}

const unsupportedCategoryCopy: Record<
  Exclude<ResourceCategoryValue, 'movie'>,
  { title: string; description: string }
> = {
  tv: {
    title: '电视剧搜索暂未接入',
    description: '这一轮只接入电影真实搜索，电视剧分类稍后再接后端接口。',
  },
  anime: {
    title: '动漫搜索暂未接入',
    description: '这一轮只接入电影真实搜索，动漫分类稍后再接后端接口。',
  },
}

function createInitialSearchState(): MovieSearchState {
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
  const [movieSearchState, setMovieSearchState] = useState<MovieSearchState>(
    createInitialSearchState,
  )
  const latestRequestIdRef = useRef(0)
  const activeRequestControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (category === 'movie') {
      return
    }

    latestRequestIdRef.current += 1
    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null
    setMovieSearchState(createInitialSearchState())
  }, [category])

  const isMovieCategory = category === 'movie'
  const isSearching = isMovieCategory && movieSearchState.status === 'loading'
  const isSearchSubmitDisabled = !isMovieCategory || isSearching
  const activeSearchPlaceholder =
    category === 'movie'
      ? '搜索电影名称…'
      : category === 'tv'
        ? '电视剧搜索暂未接入'
        : '动漫搜索暂未接入'

  function handleSearchSubmit() {
    if (category !== 'movie' || movieSearchState.status === 'loading') {
      return
    }

    const keyword = searchText.trim()
    latestRequestIdRef.current += 1
    const requestId = latestRequestIdRef.current

    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null

    if (!keyword) {
      setMovieSearchState(createInitialSearchState())
      return
    }

    const controller = new AbortController()
    activeRequestControllerRef.current = controller

    setMovieSearchState({
      status: 'loading',
      items: [],
      errorMessage: null,
    })

    void searchMovies(keyword, controller.signal)
      .then((response) => {
        if (latestRequestIdRef.current !== requestId) {
          return
        }

        const items = response.data.data.items

        setMovieSearchState({
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

        console.error('movie search failed', error)

        setMovieSearchState({
          status: 'error',
          items: [],
          errorMessage: '电影搜索失败，请稍后重试。',
        })
      })
      .finally(() => {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null
        }
      })
  }

  function renderMovieContent() {
    switch (movieSearchState.status) {
      case 'loading':
        return (
          <EmptyState
            title="正在搜索电影…"
            description="已连接后端接口，正在获取最新搜索结果。"
          />
        )

      case 'error':
        return (
          <EmptyState
            title="搜索失败"
            description={movieSearchState.errorMessage ?? '请稍后重试。'}
          />
        )

      case 'empty':
        return (
          <EmptyState
            title="没有搜索结果"
            description="换个电影名称试试，或检查关键词是否输入正确。"
          />
        )

      case 'success':
        return (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {movieSearchState.items.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        )

      case 'idle':
      default:
        return (
          <EmptyState
            title="输入电影名称开始搜索"
            description="当前仅电影分类已接入后端真实搜索接口。"
          />
        )
    }
  }

  return (
    <PageContainer
      title="资源搜索"
      description="电影分类支持按回车或点击搜索按钮发起真实搜索，电视剧与动漫分类暂时保留占位提示。"
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

        {isMovieCategory ? (
          renderMovieContent()
        ) : (
          <EmptyState
            title={unsupportedCategoryCopy[category].title}
            description={unsupportedCategoryCopy[category].description}
          />
        )}
      </div>
    </PageContainer>
  )
}
