import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'

type AuthShellProps = {
  title: string
  description: string
  children: ReactNode
  footerNote?: string
}

type AuthTextFieldProps = {
  id: string
  label: string
  placeholder: string
  type?: string
  hint?: string
  className?: string
  inputClassName?: string
}

type PasswordFieldProps = {
  id: string
  label: string
  placeholder: string
  hint?: string
}

const inputClassName =
  'w-full rounded-lg border border-transparent bg-[#f3f4f5] px-4 py-3.5 text-sm text-[#191c1d] outline-none transition-all placeholder:text-[#777777] focus:bg-white focus:ring-2 focus:ring-black/10'

function preventAuthSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
}

function AuthLogo() {
  return (
    <div className="flex flex-col items-center gap-3 text-black">
      <div className="relative flex h-10 w-10 items-center justify-center">
        <div className="absolute h-8 w-8 rotate-45 rounded-lg border-2 border-black" />
        <div className="h-3 w-3 rounded-full bg-black" />
      </div>
      <span className="text-lg font-bold">MediaNexus</span>
    </div>
  )
}

function AuthShell({ title, description, children, footerNote }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f8f9fa] px-6 py-8 text-[#191c1d]">
      <main className="my-auto flex w-full max-w-[400px] flex-col py-8">
        <header className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6">
            <AuthLogo />
          </div>
          <h1 className="mb-3 text-3xl font-semibold text-black">{title}</h1>
          <p className="text-sm text-[#555f6d]">{description}</p>
        </header>

        {children}

        {footerNote ? (
          <p className="mt-12 px-4 text-center text-xs leading-6 text-[#474747]">
            {footerNote}
          </p>
        ) : null}
      </main>

      <footer className="py-6 text-center">
        <p className="text-[0.6875rem] font-medium uppercase text-[#777777]">
          MediaNexus · Private Access
        </p>
      </footer>
    </div>
  )
}

function AuthTextField({
  id,
  label,
  placeholder,
  type = 'text',
  hint,
  className,
  inputClassName: customInputClassName,
}: AuthTextFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="pl-1 text-xs font-medium uppercase text-[#474747]" htmlFor={id}>
        {label}
      </label>
      <input
        className={cn(inputClassName, customInputClassName)}
        id={id}
        placeholder={placeholder}
        type={type}
      />
      {hint ? (
        <p className="mt-0.5 pl-1 text-[0.6875rem] text-[#474747]">{hint}</p>
      ) : null}
    </div>
  )
}

function PasswordField({ id, label, placeholder, hint }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const Icon = isVisible ? Eye : EyeOff

  return (
    <div className="flex flex-col gap-1.5">
      <label className="pl-1 text-xs font-medium uppercase text-[#474747]" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          className={cn(inputClassName, 'pr-11')}
          id={id}
          placeholder={placeholder}
          type={isVisible ? 'text' : 'password'}
        />
        <button
          aria-label={isVisible ? '隐藏密码' : '显示密码'}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#555f6d] transition-colors hover:bg-[#e7e8e9] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
      {hint ? (
        <p className="mt-0.5 pl-1 text-[0.6875rem] text-[#474747]">{hint}</p>
      ) : null}
    </div>
  )
}

function RememberMe() {
  const [isChecked, setIsChecked] = useState(false)

  return (
    <label className="group flex cursor-pointer items-center gap-2">
      <input
        checked={isChecked}
        className="sr-only"
        onChange={(event) => setIsChecked(event.target.checked)}
        type="checkbox"
      />
      <span
        className={cn(
          'relative flex h-4 w-4 items-center justify-center rounded border transition-colors',
          isChecked
            ? 'border-black bg-black'
            : 'border-[#c6c6c6] bg-[#f3f4f5]',
        )}
      >
        <Check
          aria-hidden="true"
          className={cn(
            'h-3 w-3 text-white transition-opacity',
            isChecked ? 'opacity-100' : 'opacity-0',
          )}
          strokeWidth={2.2}
        />
      </span>
      <span className="text-sm text-[#555f6d] transition-colors group-hover:text-black">
        记住我
      </span>
    </label>
  )
}

function PrimaryAuthButton({ children }: { children: ReactNode }) {
  return (
    <button
      className="w-full rounded-xl bg-gradient-to-b from-black to-[#343b4c] px-4 py-3.5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all hover:shadow-[0_6px_20px_rgba(0,0,0,0.14)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
      type="submit"
    >
      {children}
    </button>
  )
}

export function LoginPage() {
  return (
    <AuthShell title="欢迎回来" description="登录以继续管理你的媒体资源库">
      <form className="flex flex-col gap-6" onSubmit={preventAuthSubmit}>
        <AuthTextField
          id="login-username"
          label="邮箱或用户名"
          placeholder="name@example.com 或 tengen"
        />
        <PasswordField id="login-password" label="密码" placeholder="输入密码" />

        <div className="-mt-2 flex items-center justify-between gap-4">
          <RememberMe />
          <button
            className="text-sm font-medium text-black underline-offset-4 transition-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            type="button"
          >
            忘记密码？
          </button>
        </div>

        <PrimaryAuthButton>登录</PrimaryAuthButton>
      </form>

      <div className="mt-8 text-center">
        <p className="text-sm text-[#555f6d]">
          持有注册码？
          <Link
            className="ml-1 font-medium text-black underline-offset-4 transition-all hover:underline"
            to="/register"
          >
            创建账户
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}

export function RegisterPage() {
  return (
    <AuthShell
      title="创建账户"
      description="使用注册码加入你的私人媒体中心"
      footerNote="注册即表示你已获得 MediaNexus 的访问授权"
    >
      <form className="flex flex-col gap-5" onSubmit={preventAuthSubmit}>
        <AuthTextField
          id="register-email"
          label="邮箱"
          placeholder="name@example.com"
          type="email"
        />
        <AuthTextField
          id="register-username"
          label="用户名"
          placeholder="例如：tengen"
        />
        <PasswordField
          id="register-password"
          label="密码"
          placeholder="至少 8 位"
          hint="至少 8 位，建议包含字母与数字"
        />
        <PasswordField
          id="register-confirm-password"
          label="确认密码"
          placeholder="再次输入密码"
        />
        <AuthTextField
          className="mt-2"
          id="register-code"
          inputClassName="font-mono"
          label="注册码"
          placeholder="输入你收到的注册码"
          hint="注册仅对持有注册码的用户开放"
        />

        <div className="mt-6 flex flex-col items-center gap-6">
          <PrimaryAuthButton>创建账户</PrimaryAuthButton>
          <Link
            className="text-sm text-black underline decoration-black/20 underline-offset-4 transition-all hover:decoration-black"
            to="/login"
          >
            已有账号？返回登录
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
