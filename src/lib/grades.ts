/** Badge colours per grade id (ml/estate.py VILLAGE_GRADES / CONDO_GRADES). */
const TONES: Record<string, string> = {
  ultimate: "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-700 dark:text-fuchsia-300",
  super_luxury: "border-amber-300/50 bg-amber-300/15 text-amber-700 dark:text-amber-300",
  luxury: "border-violet-400/50 bg-violet-400/15 text-violet-700 dark:text-violet-300",
  high: "border-violet-400/50 bg-violet-400/15 text-violet-700 dark:text-violet-300",
  upper_medium: "border-cyan-400/50 bg-cyan-400/15 text-cyan-700 dark:text-cyan-300",
  main: "border-cyan-400/50 bg-cyan-400/15 text-cyan-700 dark:text-cyan-300",
  economy: "border-emerald-400/50 bg-emerald-400/15 text-emerald-700 dark:text-emerald-300",
  entry: "border-line bg-raised text-muted",
};

const LABELS: Record<string, string> = {
  ultimate: "Ultimate Class",
  super_luxury: "Super Luxury",
  luxury: "Luxury",
  high: "High Class",
  upper_medium: "Upper Medium",
  main: "Main Class",
  economy: "Economy",
  entry: "ต่ำกว่า Economy",
};

export function gradeTone(grade: string): string {
  return TONES[grade] ?? TONES.entry;
}

export function gradeLabel(grade: string): string {
  return LABELS[grade] ?? grade;
}
