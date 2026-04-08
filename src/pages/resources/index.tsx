import { useMemo, useState } from 'react'

import { PageContainer } from '@/components/layout/page-container'
import {
  CategorySwitch,
  type ResourceCategoryValue,
} from '@/components/resources/category-switch'
import { MediaCard } from '@/components/resources/media-card'
import { SearchBar } from '@/components/resources/search-bar'
import { mockMedia } from '@/data/mock-media'

export function ResourceSearchPage() {
  const [category, setCategory] = useState<ResourceCategoryValue>('movie')
  const [searchText, setSearchText] = useState('')

  const filteredMedia = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    return mockMedia.filter((item) => {
      if (item.category !== category) {
        return false
      }

      if (!keyword) {
        return true
      }

      return (
        item.title.toLowerCase().includes(keyword) ||
        item.year.toString().includes(keyword)
      )
    })
  }, [category, searchText])

  return (
    <PageContainer
      title="资源搜索"
      description="默认首页已指向资源搜索。当前页面已完成静态搜索框、分类切换与资源卡片展示，后续可以继续接真实接口与搜索逻辑。"
    >
      <div className="space-y-10">
        <div className="flex flex-col items-center gap-6">
          <SearchBar value={searchText} onChange={setSearchText} />
          <CategorySwitch value={category} onChange={setCategory} />
        </div>

        {filteredMedia.length > 0 ? (
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredMedia.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-8 py-14 text-center">
            <p className="text-lg font-semibold text-slate-900">没有匹配结果</p>
            <p className="mt-2 text-sm text-slate-500">
              当前是本地静态搜索，可以尝试输入其它标题关键词或切换分类。
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
