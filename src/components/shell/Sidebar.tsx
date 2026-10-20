import { useTranslation } from 'react-i18next';
import { Folder, Bookmark, CopyCheck, Settings, Film } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: number;
}

const NAV: NavItem[] = [
  { id: 'library', label: 'nav.library', icon: Film, phase: 0 },
  { id: 'collections', label: 'nav.collections', icon: Folder, phase: 6 },
  { id: 'playlists', label: 'nav.playlists', icon: Bookmark, phase: 6 },
  { id: 'duplicates', label: 'nav.duplicates', icon: CopyCheck, phase: 8 },
  { id: 'settings', label: 'nav.settings', icon: Settings, phase: 9 },
];

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-3">
      {NAV.map(({ id, label, icon: Icon, phase }) => (
        <div
          key={id}
          data-nav-item={id}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-default',
            id === 'library'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
          title={t('nav.settings') === t(label) ? undefined : `Phase ${phase}`}
        >
          <Icon className="size-4" />
          {t(label)}
        </div>
      ))}
      <div className="mt-auto px-3 text-[10px] text-muted-foreground/60">v0.1 · phase 0</div>
    </nav>
  );
}
