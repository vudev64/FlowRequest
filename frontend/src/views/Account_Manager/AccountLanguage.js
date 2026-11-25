import { useAdminPreferences } from '../AdminPreferences';

export function useAccountLanguage() {
  const { lang } = useAdminPreferences();
  return { lang, text: (vi, en) => lang === 'en' ? en : vi };
}
