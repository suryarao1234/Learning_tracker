import type { SubtopicStatus } from "../types";

/**
 * The reserved status palette: one colour per state, never reused for subject
 * accents, and always carrying its own text label so the state is never
 * conveyed by colour alone.
 */
const OPTIONS: { value: SubtopicStatus; label: string; short: string; activeClass: string }[] = [
  {
    value: "not-started",
    label: "Not started",
    short: "Todo",
    // Selected-but-untouched should not be the loudest thing on the row.
    activeClass: "bg-card text-ink shadow-sm ring-1 ring-line",
  },
  {
    value: "in-progress",
    label: "In progress",
    short: "Doing",
    activeClass: "bg-doing-soft text-doing-ink ring-1 ring-doing/30",
  },
  {
    value: "done",
    label: "Done",
    short: "Done",
    activeClass: "bg-done-soft text-done-ink ring-1 ring-done/30",
  },
];

type StatusToggleProps = {
  value: SubtopicStatus;
  onChange: (status: SubtopicStatus) => void;
  /** Names what's being set, so each group is distinguishable to a screen reader. */
  label: string;
};

/**
 * A three-way segmented control. Toggle buttons rather than radios: real radio
 * semantics promise arrow-key navigation and a roving tabindex, and claiming
 * them without implementing that is worse than not claiming them.
 */
export function StatusToggle({ value, onChange, label }: StatusToggleProps) {
  return (
    <div
      role="group"
      aria-label={`Status for ${label}`}
      className="flex shrink-0 gap-0.5 rounded-full bg-canvas p-1"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
              active ? option.activeClass : "text-ink-mute hover:bg-card hover:text-ink"
            }`}
          >
            {/* The full label is always present for assistive tech; the short
                one keeps three controls on one row on a phone. */}
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sm:hidden" aria-hidden="true">
              {option.short}
            </span>
            <span className="sr-only sm:hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
