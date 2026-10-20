import { useTranslation } from 'react-i18next';

export function DetailsPanel() {
  const { t } = useTranslation();
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card/40 xl:flex">
      <h2 className="border-b border-border px-4 py-3 text-sm font-medium">{t('details.title')}</h2>
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground/70">
        Панель метаданных наполняется данными с фазы 4
      </div>
    </aside>
  );
}
