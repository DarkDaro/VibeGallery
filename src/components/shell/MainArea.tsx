import { useTranslation } from 'react-i18next';
import { VideoOff } from 'lucide-react';
import { motion } from 'framer-motion';

export function MainArea({ mode }: { mode: 'library' | 'search-empty' }) {
  const { t } = useTranslation();

  const title = mode === 'library' ? t('empty.libraryTitle') : t('empty.searchTitle');
  const hint = mode === 'library' ? t('empty.libraryHint') : t('empty.searchHint');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col items-center gap-3 text-center"
        data-testid="empty-state"
      >
        <VideoOff className="size-10 text-muted-foreground/50" />
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
      </motion.div>
    </main>
  );
}
