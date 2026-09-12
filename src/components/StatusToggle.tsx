import type { SubtopicStatus } from "../types";

const OPTIONS: { value: SubtopicStatus; label: string; activeClass: string }[] = [
  {
    value: "not-started",
    label: "Not started",
    activeClass: "bg-slate-200 text-slate-800",
  },
  {
    value: "in-progress",
    label: "In progress",
    activeClass: "bg-amber-200 text-amber-900",
  },
  { value: "done", label: "Done", activeClass: "bg-emerald-200 text-emerald-900" },
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
      className="flex shrink-0 gap-0.5 rounded-md bg-slate-100 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${
              active
                ? option.activeClass
                : "text-slate-500 hover:bg-white hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
