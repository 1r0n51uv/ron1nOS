import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type WidgetAction = { label: string; to?: string; onClick?: () => void }

// Un dato per widget: titolo, un'azione o una meta a destra, il contenuto sotto.
export function WidgetCard({
  title,
  action,
  meta,
  className,
  children,
}: {
  title: string
  action?: WidgetAction
  meta?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action ? (
          <CardAction>
            {action.to ? (
              <Link
                to={action.to}
                className="hit-area text-[13px] leading-[18px] text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="hit-area cursor-pointer border-0 bg-transparent px-0 text-[13px] leading-[18px] text-ink underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
              >
                {action.label}
              </button>
            )}
          </CardAction>
        ) : meta ? (
          <CardAction className="eyebrow">{meta}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
