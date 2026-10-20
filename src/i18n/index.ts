import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ru } from './ru';
import { en } from './en';

i18next.use(initReactI18next).init({
  resources: { ru, en },
  lng: 'ru',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function changeAppLanguage(lng: 'ru' | 'en'): void {
  void i18next.changeLanguage(lng);
}

export default i18next;
