import { createI18n } from 'vue-i18n';
import en from './locales/en';
import pt from './locales/pt';
import es from './locales/es';

function detectLocale(): string {
  const saved = localStorage.getItem('locale');
  if (saved && ['en', 'pt', 'es'].includes(saved)) return saved;

  const nav = navigator.language.slice(0, 2);
  if (['pt', 'es'].includes(nav)) return nav;
  return 'en';
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, pt, es },
});

export default i18n;
