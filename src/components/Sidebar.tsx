import { accentFor, avatarStyle, initialOf } from "../lib/accent";
import { subjectProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";
import { ProgressBar } from "./ProgressBar";

type SidebarProps = {
  /** The selected subject, or null when the overview is showing. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onImport: () => void;
  onOpenSettings: () => void;
  /** Whether the narrow-screen drawer is showing. Ignored from `sm` up. */
  open: boolean;
  onClose: () => void;
};

export function Sidebar({
  selectedId,
  onSelect,
  onImport,
  onOpenSettings,
  open,
  onClose,
}: SidebarProps) {
  const { data } = useLearningData();
  const hasData = data.subjects.length > 0;

  // Below `sm` there isn't room for a permanent sidebar beside the tracker, so
  // it becomes a drawer over it. From `sm` up it's an ordinary column again.
  return (
    <>
      {open && (
        <div
          className="absolute inset-0 z-20 bg-ink/30 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`${
          open ? "flex" : "hidden"
        } absolute inset-y-0 left-0 z-30 w-64 shrink-0 flex-col border-r border-line bg-card shadow-xl sm:static sm:z-auto sm:flex sm:shadow-none`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark />
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            Learning Tracker
          </span>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onImport();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/25 transition hover:bg-brand-ink"
          >
            <PlusIcon />
            Import roadmap
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-2">
          <NavItem
            active={selectedId === null}
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            icon={<HomeIcon />}
            label="Overview"
          />

          <p className="mt-5 mb-2 px-3 text-[11px] font-bold tracking-wider text-ink-mute uppercase">
            Subjects
          </p>

          {!hasData ? (
            <p className="px-3 pb-3 text-sm leading-relaxed text-ink-mute">
              Nothing here yet. Import a roadmap to get started.
            </p>
          ) : (
            <ul className="space-y-1">
              {data.subjects.map((subject) => {
                const progress = subjectProgress(subject);
                const accent = accentFor(subject.id);
                const selected = subject.id === selectedId;
                return (
                  <li key={subject.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(subject.id);
                        onClose();
                      }}
                      aria-current={selected ? "true" : undefined}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                        selected ? "bg-brand-soft" : "hover:bg-canvas"
                      }`}
                    >
                      {/* The name gets the full width; the percentage rides
                          with the bar below it, so long subject names aren't
                          cut short to make room for four characters. */}
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          style={avatarStyle(accent)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold"
                        >
                          {initialOf(subject.name)}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate text-sm font-bold ${
                            selected ? "text-brand-ink" : "text-ink"
                          }`}
                        >
                          {subject.name}
                        </span>
                      </span>
                      <span className="mt-2 flex items-center gap-2">
                        <ProgressBar
                          percent={progress.percent}
                          inProgressPercent={progress.inProgressPercent}
                        />
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink-mute">
                          {progress.percent}%
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {hasData && <EncouragementCard />}

        <div className="border-t border-line p-3">
          <NavItem
            active={false}
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            icon={<GearIcon />}
            label="Settings"
          />
        </div>
      </aside>
    </>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
        active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-canvas hover:text-ink"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

/**
 * A small note at the foot of the sidebar. The reference has a mascot here;
 * this keeps the warmth without pretending to track anything it doesn't.
 */
function EncouragementCard() {
  return (
    <div className="mx-3 mb-3 rounded-xl bg-accent-b-soft px-3 py-3">
      <p className="text-sm leading-snug font-bold text-ink">Small steps add up.</p>
      <p className="mt-0.5 text-xs leading-snug text-ink-soft">
        One subtopic today beats a perfect plan tomorrow.
      </p>
    </div>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 place-items-center rounded-xl bg-brand shadow-sm shadow-brand/30"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="none">
        <path
          d="M3 5.5A1.5 1.5 0 0 1 4.5 4H9a2 2 0 0 1 2 2v9a1.6 1.6 0 0 0-1.2-.9H4.5A1.5 1.5 0 0 1 3 12.6V5.5Z"
          fill="currentColor"
          opacity="0.55"
        />
        <path
          d="M17 5.5A1.5 1.5 0 0 0 15.5 4H11a2 2 0 0 0-2 2v9a1.6 1.6 0 0 1 1.2-.9h5.3a1.5 1.5 0 0 0 1.5-1.5V5.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M2.5 7 8 2.5 13.5 7v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8m10.1-4.3-1 1M4.1 11.9l-1 1m9.8 0-1-1M4.1 4.1l-1-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
