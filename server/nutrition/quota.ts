// Quota del giorno (NUT-016, ADR-0019 emendata): obiettivo di base più
// l'energia attiva letta da YAZIO, con un tetto. Il riepilogo di YAZIO
// la comprende già: qui si applica solo il tetto, gli esercizi non si
// sommano di nuovo.
export const ACTIVITY_CAP_KCAL = 1200

export type Quota = { kcal: number; baseKcal: number; activityKcal: number }

// L'attività conta solo se in YAZIO è attivo "conta le calorie delle
// attività"; senza YAZIO la quota è l'obiettivo di base.
export function quotaFor(baseKcal: number, activity: { kcal: number; counted: boolean } | null): Quota {
  const activityKcal = activity?.counted
    ? Math.round(Math.min(Math.max(0, activity.kcal), ACTIVITY_CAP_KCAL))
    : 0
  return { kcal: baseKcal + activityKcal, baseKcal, activityKcal }
}
