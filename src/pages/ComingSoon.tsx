import { WidgetCard } from '@/components/ron1n'

export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1 className="m-0 font-display text-[44px] leading-[48px] font-bold">{title}</h1>
      <WidgetCard title="Modulo in arrivo" className="max-w-xl">
        <p className="m-0 text-sm leading-[1.6] text-ink-muted">
          Questa sezione si accende quando il modulo avrà la sua sorgente dati. Per ora i dati di prova sono
          sulla dashboard.
        </p>
      </WidgetCard>
    </>
  )
}
