import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function AutomationNavigation({ active }: { active: 'javdb' | 'telegram' | 'bgm' }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="自动化功能">
      {([
        ['javdb', '/automation', 'JAVDB 自动化'],
        ['telegram', '/automation/telegram', 'Telegram 自动化'],
        ['bgm', '/automation/bgm-wishlist', 'BGM 想看'],
      ] as const).map(([key, path, label]) => key === active ? (
        <Button key={key} type="button" size="sm" aria-current="page">{label}</Button>
      ) : (
        <Button key={key} asChild size="sm" variant="outline"><Link to={path}>{label}</Link></Button>
      ))}
    </nav>
  )
}
