import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Languages } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useSettings } from '../../stores/settings';
import { changeAppLanguage } from '../../i18n';
import type { Settings } from '../../../shared/settings';

export function Toolbar() {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const setSetting = useSettings((s) => s.setSetting);

  const cycleTheme = () => {
    const order: Settings['theme'][] = ['system', 'dark', 'light'];
    const next = order[(order.indexOf(settings.theme) + 1) % order.length]!;
    setSetting('theme', next);
  };

  const ThemeIcon = settings.theme === 'system' ? Monitor : settings.theme === 'dark' ? Moon : Sun;

  const cycleLanguage = () => {
    const next = settings.language === 'ru' ? 'en' : 'ru';
    setSetting('language', next);
    changeAppLanguage(next);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/40 px-4">
      <Input
        className="max-w-md"
        placeholder={t('toolbar.searchPlaceholder')}
        disabled
        aria-label={t('toolbar.searchPlaceholder')}
      />
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={cycleLanguage}>
          <Languages className="size-4" />
          <span className="text-xs uppercase">{settings.language}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={`${t('theme.label')}: ${t(`theme.${settings.theme}`)}`}
          data-testid="theme-toggle"
        >
          <ThemeIcon className="size-4" />
        </Button>
      </div>
    </header>
  );
}
