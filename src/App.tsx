import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipProvider } from './components/ui/tooltip';
import { Sidebar } from './components/shell/Sidebar';
import { Toolbar } from './components/shell/Toolbar';
import { MainArea } from './components/shell/MainArea';
import { DetailsPanel } from './components/shell/DetailsPanel';
import { useSettings } from './stores/settings';
import { changeAppLanguage } from './i18n';

export default function App() {
  const { i18n } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const systemIsDark = useSettings((s) => s.systemIsDark);
  const init = useSettings((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  const resolvedDark = settings.theme === 'system' ? systemIsDark : settings.theme === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedDark);
  }, [resolvedDark]);

  useEffect(() => {
    if (i18n.language !== settings.language) changeAppLanguage(settings.language);
  }, [settings.language, i18n]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar />
          <div className="flex min-h-0 flex-1">
            <MainArea mode="library" />
            <DetailsPanel />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
