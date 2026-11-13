import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { HankoMark } from '@/components/ron1n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { safeNext, useLogin, useMe } from './data'

const CODE_LENGTH = 4

// Pagina di login (AUTH-001, AUTH-007): solo il codice a 4 cifre, poi si torna
// alla pagina richiesta. Alla quarta cifra il codice parte da solo.
export function LoginPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const me = useMe()
  const login = useLogin()
  const [password, setPassword] = useState('')
  const fieldId = useId()
  const errorId = useId()

  if (me.data) return <Navigate to={next} replace />

  const error = login.error
    ? login.error instanceof ApiError && login.error.status !== 0
      ? login.error.message
      : 'Backend non raggiungibile'
    : null

  function send(code: string) {
    if (code.length !== CODE_LENGTH || login.isPending) return
    login.mutate(code, {
      onSuccess: () => navigate(next, { replace: true }),
      onError: () => setPassword(''),
    })
  }

  function change(value: string) {
    const code = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setPassword(code)
    send(code)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    send(password)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[120px] -right-10 font-kanji text-[520px] leading-none font-bold text-white/[0.035]"
      >
        浪人
      </div>
      <form
        onSubmit={submit}
        aria-label="Accesso"
        className="relative flex w-full max-w-[400px] flex-col gap-5 rounded-[28px] p-8 glass-panel"
      >
        <div className="flex items-center gap-3.5">
          <HankoMark size={48} decorative />
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 font-display text-2xl leading-7 font-semibold">ron1nOS</h1>
            <span className="text-[13px] text-ink-muted">Accedi per continuare</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId} className="text-[13px] text-ink-muted">
            Codice
          </label>
          <Input
            id={fieldId}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => change(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="text-center font-mono text-2xl tracking-[0.5em]"
          />
          {error ? (
            <span id={errorId} role="alert" className="text-[13px] text-brand-text">
              {error}
            </span>
          ) : null}
        </div>
        <Button type="submit" disabled={password.length !== CODE_LENGTH || login.isPending}>
          Accedi
        </Button>
      </form>
    </div>
  )
}
