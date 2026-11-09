import { Link } from 'react-router-dom'

import { useAutomationAccess } from '@/lib/automation-access'
import { Button } from '@/components/ui/button'

export function AutomationNavigation({ active }: { active: 'javdb' | 'telegram' | 'bgm' | 'douban' | 'wecom' }) {
  const { visible } = useAutomationAccess()
  return (
    <nav className="flex flex-wrap gap-2" aria-label="自动化功能">
      {([
        ['javdb', '/automation', 'JAVDB 自动化'],
        ['telegram', '/automation/telegram', 'Telegram 自动化'],
        ['bgm', '/automation/bgm-wishlist', 'BGM 想看'],
        ['douban', '/automation/douban-wishlist', '豆瓣想看'],
        ['wecom', '/automation/wecom', '微信自动化'],
      ] as const).filter(([key]) => visible(key)).map(([key, path, label]) => key === active ? (
        <Button key={key} type="button" size="sm" aria-current="page">{label}</Button>
      ) : (
        <Button key={key} asChild size="sm" variant="outline"><Link to={path}>{label}</Link></Button>
      ))}
    </nav>
  )
}
