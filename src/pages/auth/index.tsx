import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff } from 'lucide-react'

import {
  login as loginWithPassword,
  register as registerWithCode,
} from '@/lib/api/auth'
import { useAuth } from '@/lib/use-auth'
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
  value: string
  onChange: (value: string) => void
  type?: string
  hint?: string
  autoComplete?: string
  className?: string
  inputClassName?: string
  maxLength?: number
}

type PasswordFieldProps = {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  hint?: string
  autoComplete?: string
  maxLength?: number
}

type AuthFormStatus = 'idle' | 'submitting'

const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 32

const inputClassName =
  'w-full rounded-lg border border-transparent bg-[#f3f4f5] px-4 py-3.5 text-sm text-[#191c1d] outline-none transition-all placeholder:text-[#777777] focus:bg-white focus:ring-2 focus:ring-black/10'

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

function getAuthRedirectPath(state: unknown) {
  if (!state || typeof state !== 'object') {
    return '/resources'
  }

  const from = (state as { from?: { pathname?: string; search?: string; hash?: string } }).from
  if (!from || typeof from.pathname !== 'string') {
    return '/resources'
  }

  if (from.pathname === '/login' || from.pathname === '/register') {
    return '/resources'
  }

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
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

        <div className="mt-6 text-center">
          <Link
            className="text-sm font-medium text-black underline-offset-4 transition-all hover:underline"
            to="/help"
          >
            查看使用说明
          </Link>
        </div>
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
  value,
  onChange,
  type = 'text',
  hint,
  autoComplete,
  className,
  inputClassName: customInputClassName,
  maxLength,
}: AuthTextFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        className="pl-1 text-xs font-medium uppercase text-[#474747]"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        autoComplete={autoComplete}
        className={cn(inputClassName, customInputClassName)}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {hint ? (
        <p className="mt-0.5 pl-1 text-[0.6875rem] text-[#474747]">{hint}</p>
      ) : null}
    </div>
  )
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
  autoComplete,
  maxLength,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const Icon = isVisible ? Eye : EyeOff

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="pl-1 text-xs font-medium uppercase text-[#474747]"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className={cn(inputClassName, 'pr-11')}
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={isVisible ? 'text' : 'password'}
          value={value}
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

function PrimaryAuthButton({
  children,
  disabled,
}: {
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      className={cn(
        'w-full rounded-xl bg-gradient-to-b from-black to-[#343b4c] px-4 py-3.5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all hover:shadow-[0_6px_20px_rgba(0,0,0,0.14)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
        disabled && 'cursor-not-allowed opacity-70 hover:shadow-none',
      )}
      disabled={disabled}
      type="submit"
    >
      {children}
    </button>
  )
}

function AuthErrorNotice({ message }: { message: string | null }) {
  if (!message) {
    return null
  }

  return (
    <div
      className="rounded-lg bg-[#ffdad6] px-4 py-3 text-sm leading-6 text-[#410002]"
      role="alert"
    >
      {message}
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, status: authStatus } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<AuthFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isSubmitting = status === 'submitting'
  const redirectPath = getAuthRedirectPath(location.state)

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate(redirectPath, { replace: true })
    }
  }, [authStatus, navigate, redirectPath])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const normalizedAccount = account.trim()
    const normalizedPassword = password.trim()

    if (!normalizedAccount) {
      setErrorMessage('请输入邮箱或用户名')
      return
    }
    if (!normalizedPassword) {
      setErrorMessage('请输入密码')
      return
    }

    setStatus('submitting')
    setErrorMessage(null)

    try {
      const session = await loginWithPassword({
        account: normalizedAccount,
        password: normalizedPassword,
      })
      signIn(session)
      navigate(redirectPath, { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '登录失败，请稍后重试。'))
    } finally {
      setStatus('idle')
    }
  }

  return (
    <AuthShell title="欢迎回来" description="登录以继续管理你的媒体资源库">
      <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
        <AuthErrorNotice message={errorMessage} />
        <AuthTextField
          autoComplete="username"
          id="login-username"
          label="邮箱或用户名"
          onChange={setAccount}
          placeholder="name@example.com 或 tengen"
          value={account}
        />
        <PasswordField
          autoComplete="current-password"
          id="login-password"
          label="密码"
          maxLength={MAX_PASSWORD_LENGTH}
          onChange={setPassword}
          placeholder="输入密码"
          value={password}
        />

        <div className="-mt-2 flex items-center justify-between gap-4">
          <RememberMe />
          <button
            className="text-sm font-medium text-black underline-offset-4 transition-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            type="button"
          >
            忘记密码？
          </button>
        </div>

        <PrimaryAuthButton disabled={isSubmitting}>
          {isSubmitting ? '登录中…' : '登录'}
        </PrimaryAuthButton>
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
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, status: authStatus } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [status, setStatus] = useState<AuthFormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const registrationCompleteRef = useRef(false)

  const isSubmitting = status === 'submitting'
  const redirectPath = getAuthRedirectPath(location.state)

  useEffect(() => {
    if (
      authStatus === 'authenticated' &&
      !registrationCompleteRef.current
    ) {
      navigate(redirectPath, { replace: true })
    }
  }, [authStatus, navigate, redirectPath])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const normalizedUsername = normalizeUsername(username)
    const normalizedEmail = normalizeEmail(email)
    const normalizedPassword = password.trim()
    const normalizedConfirmPassword = confirmPassword.trim()
    const normalizedRegistrationCode = registrationCode.trim()

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setErrorMessage('用户名需为 3-32 位小写字母、数字、下划线或短横线')
      return
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage('邮箱格式无效')
      return
    }
    if (
      normalizedPassword.length < MIN_PASSWORD_LENGTH ||
      normalizedPassword.length > MAX_PASSWORD_LENGTH
    ) {
      setErrorMessage('密码需为 8-32 位')
      return
    }
    if (normalizedPassword !== normalizedConfirmPassword) {
      setErrorMessage('两次输入的密码不一致')
      return
    }
    if (!normalizedRegistrationCode) {
      setErrorMessage('注册码不能为空')
      return
    }

    setStatus('submitting')
    setErrorMessage(null)

    try {
      const session = await registerWithCode({
        username: normalizedUsername,
        email: normalizedEmail,
        password: normalizedPassword,
        confirm_password: normalizedConfirmPassword,
        registration_code: normalizedRegistrationCode,
      })
      registrationCompleteRef.current = true
      signIn(session)
      setRegistrationComplete(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error, '注册失败，请稍后重试。'))
    } finally {
      setStatus('idle')
    }
  }

  return (
    <AuthShell
      title="创建账户"
      description="使用注册码加入你的私人媒体中心"
      footerNote="注册即表示你已获得 MediaNexus 的访问授权"
    >
      <form className="flex flex-col gap-5" noValidate onSubmit={handleSubmit}>
        <AuthErrorNotice message={errorMessage} />
        <AuthTextField
          autoComplete="email"
          id="register-email"
          label="邮箱"
          maxLength={128}
          onChange={(value) => setEmail(value.toLowerCase())}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
        <AuthTextField
          autoComplete="username"
          hint="3-32 位，小写字母、数字、下划线或短横线"
          id="register-username"
          label="用户名"
          maxLength={32}
          onChange={(value) => setUsername(value.toLowerCase())}
          placeholder="例如：tengen"
          value={username}
        />
        <PasswordField
          autoComplete="new-password"
          hint="8-32 位，建议包含字母与数字"
          id="register-password"
          label="密码"
          maxLength={MAX_PASSWORD_LENGTH}
          onChange={setPassword}
          placeholder="输入密码"
          value={password}
        />
        <PasswordField
          autoComplete="new-password"
          id="register-confirm-password"
          label="确认密码"
          maxLength={MAX_PASSWORD_LENGTH}
          onChange={setConfirmPassword}
          placeholder="再次输入密码"
          value={confirmPassword}
        />
        <AuthTextField
          autoComplete="off"
          className="mt-2"
          hint="注册仅对持有注册码的用户开放"
          id="register-code"
          inputClassName="font-mono"
          label="注册码"
          onChange={setRegistrationCode}
          placeholder="输入你收到的注册码"
          value={registrationCode}
        />

        <div className="mt-6 flex flex-col items-center gap-6">
          <PrimaryAuthButton disabled={isSubmitting}>
            {isSubmitting ? '创建中…' : '创建账户'}
          </PrimaryAuthButton>
          <Link
            className="text-sm text-black underline decoration-black/20 underline-offset-4 transition-all hover:decoration-black"
            to="/login"
          >
            已有账号？返回登录
          </Link>
        </div>
      </form>

      {registrationComplete ? (
        <div
          aria-labelledby="registration-complete-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl ring-1 ring-black/5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="h-5 w-5" />
            </div>
            <h2
              className="mt-5 text-xl font-semibold text-slate-950"
              id="registration-complete-title"
            >
              注册完成，Emby 账号已开通
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              请前往帮助页查看 Emby 的登录账号、密码和可用线路。MediaNexus
              与 Emby 使用不同密码。
            </p>
            <button
              className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={() => navigate('/help#player-access', { replace: true })}
              type="button"
            >
              查看 Emby 使用方式
            </button>
          </div>
        </div>
      ) : null}
    </AuthShell>
  )
}
