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
  searchSeries,
} from '@/lib/api/resources'
import type { SearchableResourceItem } from '@/types/resources'

type SearchableCategory = Extract<ResourceCategoryValue, 'movie' | 'tv'>

type ResourceSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

type ResourceSearchState = {
  status: ResourceSearchStatus
  items: SearchableResourceItem[]
  errorMessage: string | null
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
  const latestRequestIdRef = useRef(0)
  const activeRequestControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    latestRequestIdRef.current += 1
    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null
    setSearchState(createInitialSearchState())
  }, [category])

  const isCategorySearchable = isSearchableCategory(category)
  const activeCategoryCopy = isCategorySearchable
    ? searchableCategoryCopy[category]
    : null
  const isSearching = isCategorySearchable && searchState.status === 'loading'
  const isSearchSubmitDisabled = !isCategorySearchable || isSearching
  const activeSearchPlaceholder = activeCategoryCopy?.placeholder ?? '动漫搜索暂未接入'

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
      setSearchState(createInitialSearchState())
      return
    }

    const controller = new AbortController()
    activeRequestControllerRef.current = controller

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
            {searchState.items.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
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

        {renderSearchContent()}
      </div>
    </PageContainer>
  )
}
