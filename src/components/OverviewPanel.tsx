import { accentFor, avatarStyle, initialOf } from "../lib/accent";
import { focusSubject, inFlightSubjects, nextUp } from "../lib/overview";
import { overallProgress, subjectProgress } from "../lib/progress";
import { useLearningData } from "../state/useLearningData";
import type { Subject, SubtopicStatus } from "../types";
import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";

type OverviewPanelProps = {
  onOpenSubject: (id: string) => void;
  onImport: () => void;
};

export function OverviewPanel({ onOpenSubject, onImport }: OverviewPanelProps) {
  const { data, setSubtopicStatus } = useLearningData();

  if (data.subjects.length === 0) {
    return <EmptyState onImport={onImport} />;
  }

  const overall = overallProgress(data.subjects);
  const focus = focusSubject(data.subjects);
  const upcoming = nextUp(data.subjects, 5);

  // Three disjoint groups, so no subject is listed twice and each heading says
  // something true about the cards under it. Empty groups aren't rendered.
  const resumable = inFlightSubjects(data.subjects);
  const resumableIds = new Set(resumable.map((s) => s.id));
  const done = data.subjects.filter((s) => {
    const p = subjectProgress(s);
    return p.total > 0 && p.percent === 100;
  });
  const doneIds = new Set(done.map((s) => s.id));
  const untouched = data.subjects.filter(
    (s) => !resumableIds.has(s.id) && !doneIds.has(s.id),
  );
  const finished = done.length;

  return (
    <div className="space-y-5">
      {focus && <FocusCard subject={focus} onOpen={() => onOpenSubject(focus.id)} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className="grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Progress">
              <ProgressRing
                percent={overall.percent}
                inProgressPercent={overall.inProgressPercent}
                label={`${overall.percent}%`}
                size={72}
              />
              <p className="mt-2 text-xs leading-tight font-semibold text-ink-soft">
                {overall.done} of {overall.total} done
              </p>
            </StatCard>

            <StatCard label="Subjects">
              <BigNumber value={data.subjects.length} tone="a" />
              <p className="mt-2 text-xs leading-tight font-semibold text-ink-soft">
                {finished === 0 ? "none finished" : `${finished} finished`}
              </p>
            </StatCard>

            <StatCard label="Started">
              <BigNumber value={overall.inProgress} tone="doing" />
              <p className="mt-2 text-xs leading-tight font-semibold text-ink-soft">
                {overall.inProgress === 1 ? "subtopic" : "subtopics"}
              </p>
            </StatCard>
          </section>

          {resumable.length > 0 && (
            <section>
              <SectionHeading
                title="Continue learning"
                hint={`${resumable.length} ${resumable.length === 1 ? "subject" : "subjects"} on the go`}
              />
              <ul className="grid gap-3 sm:grid-cols-2">
                {resumable.map((subject) => (
                  <li key={subject.id}>
                    <SubjectCard subject={subject} onOpen={() => onOpenSubject(subject.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {untouched.length > 0 && (
            <section>
              <SectionHeading
                title="Not started yet"
                hint={`${untouched.length} waiting`}
              />
              <ul className="grid gap-3 sm:grid-cols-2">
                {untouched.map((subject) => (
                  <li key={subject.id}>
                    <SubjectCard subject={subject} onOpen={() => onOpenSubject(subject.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <SectionHeading title="Finished" hint={`${done.length} complete`} />
              <ul className="grid gap-3 sm:grid-cols-2">
                {done.map((subject) => (
                  <li key={subject.id}>
                    <SubjectCard subject={subject} onOpen={() => onOpenSubject(subject.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <UpNextCard
          items={upcoming}
          onMark={(subjectId, topicId, subtopicId, status) =>
            setSubtopicStatus(subjectId, topicId, subtopicId, status)
          }
          onOpenSubject={onOpenSubject}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-base font-extrabold tracking-tight text-ink">{title}</h2>
      {hint && <span className="text-xs font-semibold text-ink-mute">{hint}</span>}
    </div>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-card p-4 text-center shadow-sm ring-1 ring-line">
      <p className="mb-3 text-[11px] font-bold tracking-wider text-ink-mute uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function BigNumber({ value, tone }: { value: number; tone: "a" | "doing" }) {
  return (
    <span
      className={`grid h-[72px] w-[72px] place-items-center rounded-full text-2xl font-extrabold tabular-nums ${
        tone === "a" ? "bg-accent-a-soft text-accent-a" : "bg-doing-soft text-doing-ink"
      }`}
    >
      {value}
    </span>
  );
}

/** The hero: one subject to pick up, with its progress and a way in. */
function FocusCard({ subject, onOpen }: { subject: Subject; onOpen: () => void }) {
  const progress = subjectProgress(subject);
  const accent = accentFor(subject.id);
  const started = progress.done + progress.inProgress > 0;

  return (
    <section
      className="relative overflow-hidden rounded-3xl px-5 py-6 sm:px-7"
      style={{
        background: `linear-gradient(115deg, ${accent.heroFrom} 0%, ${accent.heroTo} 100%)`,
        color: accent.heroText,
      }}
    >
      {/* Soft shapes, so the hero reads as a warm surface rather than a slab. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full ${
          accent.heroOnDark ? "bg-white/15" : "bg-white/25"
        }`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-16 -bottom-24 h-52 w-52 rounded-full ${
          accent.heroOnDark ? "bg-white/10" : "bg-white/20"
        }`}
      />

      <div className="relative flex flex-wrap items-center gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider uppercase opacity-80">
            {started ? "Pick up where you left off" : "Ready when you are"}
          </p>
          <h2 className="mt-1.5 text-2xl leading-tight font-extrabold tracking-tight break-words sm:text-3xl">
            {subject.name}
          </h2>
          <p className="mt-1 text-sm font-semibold opacity-85">
            {progress.total === 0
              ? "No subtopics yet."
              : `${progress.done} of ${progress.total} subtopics done${
                  progress.inProgress > 0 ? ` · ${progress.inProgress} in progress` : ""
                }`}
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-card px-4 py-2 text-sm font-bold text-ink shadow-sm transition hover:bg-canvas"
          >
            {started ? "Continue" : "Start"}
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
              <path
                d="M6 3.5 10.5 8 6 12.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div
          className={`rounded-2xl p-3 ${accent.heroOnDark ? "bg-white/15" : "bg-white/30"}`}
        >
          <ProgressRing
            percent={progress.percent}
            inProgressPercent={progress.inProgressPercent}
            size={96}
            stroke={10}
            color={accent.heroText}
            trackColor={accent.heroOnDark ? "rgba(255,255,255,0.28)" : "rgba(27,36,64,0.18)"}
            label={`${progress.percent}%`}
            caption="done"
            variant={accent.heroOnDark ? "onColor" : "onSurface"}
          />
        </div>
      </div>
    </section>
  );
}

function SubjectCard({ subject, onOpen }: { subject: Subject; onOpen: () => void }) {
  const progress = subjectProgress(subject);
  const accent = accentFor(subject.id);
  const complete = progress.percent === 100 && progress.total > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          style={avatarStyle(accent)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold"
        >
          {initialOf(subject.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">{subject.name}</p>
          <p className="mt-0.5 text-xs font-medium text-ink-soft">
            {subject.topics.length} {subject.topics.length === 1 ? "topic" : "topics"} ·{" "}
            {progress.total} {progress.total === 1 ? "subtopic" : "subtopics"}
          </p>
        </div>
        {complete && (
          <span className="shrink-0 rounded-full bg-done-soft px-2 py-0.5 text-[11px] font-bold text-done-ink">
            Done
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar
          percent={progress.percent}
          inProgressPercent={progress.inProgressPercent}
          size="md"
        />
        <span className="shrink-0 text-xs font-extrabold tabular-nums text-ink">
          {progress.percent}%
        </span>
      </div>
    </button>
  );
}

/** The reference's "Today's Plan", built from what's actually tracked. */
function UpNextCard({
  items,
  onMark,
  onOpenSubject,
}: {
  items: ReturnType<typeof nextUp>;
  onMark: (
    subjectId: string,
    topicId: string,
    subtopicId: string,
    status: SubtopicStatus,
  ) => void;
  onOpenSubject: (id: string) => void;
}) {
  return (
    <aside className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line lg:sticky lg:top-4 lg:self-start">
      <h2 className="text-base font-extrabold tracking-tight text-ink">Up next</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        Anything started comes first, then the next untouched subtopics.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-done-soft px-3 py-4 text-center text-sm font-bold text-done-ink">
          Everything's done. 🎉
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {items.map(({ subject, topic, subtopic }) => {
            const accent = accentFor(subject.id);
            const started = subtopic.status === "in-progress";
            return (
              <li
                key={subtopic.id}
                className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition hover:bg-canvas"
              >
                <button
                  type="button"
                  onClick={() =>
                    onMark(subject.id, topic.id, subtopic.id, started ? "done" : "in-progress")
                  }
                  title={started ? "Mark as done" : "Mark as in progress"}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
                    started
                      ? "border-doing bg-doing-soft text-doing-ink"
                      : "border-line text-transparent hover:border-done hover:text-done"
                  }`}
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 6.2 5 8.5l4.5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="sr-only">
                    {started
                      ? `Mark ${subtopic.name} as done`
                      : `Mark ${subtopic.name} as in progress`}
                  </span>
                </button>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {subtopic.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenSubject(subject.id)}
                    className="mt-0.5 flex max-w-full items-center gap-1.5 text-left text-xs text-ink-mute hover:text-ink"
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: accent.deepHex }}
                      className="h-2 w-2 shrink-0 rounded-full"
                    />
                    <span className="truncate">
                      {subject.name} · {topic.name}
                    </span>
                  </button>
                </span>

                {started && (
                  <span className="shrink-0 rounded-full bg-doing-soft px-2 py-0.5 text-[10px] font-bold text-doing-ink">
                    Started
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-card px-6 py-12 text-center shadow-sm ring-1 ring-line">
      <span
        aria-hidden="true"
        className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-3xl"
      >
        🗺️
      </span>
      <h2 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
        Start with a roadmap
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Paste one from anywhere — Markdown, a bullet list, plain text. It gets read into
        subjects, topics and subtopics that you can tick off as you go.
      </p>
      <button
        type="button"
        onClick={onImport}
        className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/25 transition hover:bg-brand-ink"
      >
        Import a roadmap
      </button>
    </div>
  );
}
