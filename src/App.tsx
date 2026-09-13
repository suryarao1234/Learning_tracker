import { useState } from "react";
import { ImportModal } from "./components/ImportModal";
import { OverviewPanel } from "./components/OverviewPanel";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { StorageErrorBanner } from "./components/StorageErrorBanner";
import { SubjectPanel } from "./components/SubjectPanel";
import { TopBar } from "./components/TopBar";
import { LearningDataProvider } from "./state/LearningDataProvider";
import { useLearningData } from "./state/useLearningData";

function Workspace() {
  const { data } = useLearningData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Derived rather than stored, so a selection that no longer exists (after a
  // reset, or a backup import) falls back to the overview without an effect.
  const selected = selectedId
    ? (data.subjects.find((subject) => subject.id === selectedId) ?? null)
    : null;

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <StorageErrorBanner />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onImport={() => setImportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
          <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-7">
            {selected ? (
              <SubjectPanel subject={selected} onBack={() => setSelectedId(null)} />
            ) : (
              <OverviewPanel
                onOpenSubject={setSelectedId}
                onImport={() => setImportOpen(true)}
              />
            )}
          </main>
        </div>
      </div>

      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} onSaved={setSelectedId} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <LearningDataProvider>
      <Workspace />
    </LearningDataProvider>
  );
}
