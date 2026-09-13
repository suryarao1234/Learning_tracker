import { useState } from "react";
import { ImportModal } from "./components/ImportModal";
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
  // reset, or after loading the sample data) falls back to the first subject
  // without a render-triggering effect.
  const selected =
    data.subjects.find((subject) => subject.id === selectedId) ?? data.subjects[0] ?? null;

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900">
      <StorageErrorBanner />
      <TopBar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onImport={() => setImportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <SubjectPanel subject={selected} onImport={() => setImportOpen(true)} />
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
