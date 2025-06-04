import { useRouter } from 'next/router';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: "Welcome to our site!",
    footer: "Powered by GoodRobot"
  },
  es: {
    title: "¡Bienvenidos!",
    footer: "Desarrollado por GoodRobot"
  },
  fr: {
    title: "Bienvenue !",
    footer: "Propulsé par GoodRobot"
  }
};

export function useLocale(lang: string = 'en') {
  return translations[lang] || translations['en'];
}
