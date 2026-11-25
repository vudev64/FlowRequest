import { createContext, useContext, useMemo, useState } from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import { adminEnglish } from './adminEnglish';
import './AdminPreferences.css';
import { useSystemConfiguration } from './SystemConfiguration';

const Preferences = createContext(null);
function initialPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem('flowrequest_admin_preferences'));
    return { lang: ['vi','en'].includes(saved?.lang) ? saved.lang : null, theme: saved?.theme === 'dark' ? 'dark' : 'light' };
  } catch { return { lang: null, theme: 'light' }; }
}
export function AdminPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const { settings } = useSystemConfiguration();
  const effectiveLanguage = preferences.lang || settings?.general?.language || 'vi';
  const value = useMemo(() => {
    function update(key, value) {
      setPreferences(previous => {
        const next = { ...previous, [key]: value };
        try { localStorage.setItem('flowrequest_admin_preferences', JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
        return next;
      });
    }
    return { ...preferences, lang: effectiveLanguage, t: text => effectiveLanguage === 'en' && typeof text === 'string' ? adminEnglish[text] || text.replace(/^(\+?\d+) tháng này$/, '$1 this month').replace(/^(\d+)% tổng số$/, '$1% of total') : text,
      toggleLang: () => update('lang', effectiveLanguage === 'vi' ? 'en' : 'vi'),
      toggleTheme: () => update('theme', preferences.theme === 'light' ? 'dark' : 'light') };
  }, [preferences, effectiveLanguage]);
  return <Preferences.Provider value={value}>{children}</Preferences.Provider>;
}
export function useAdminPreferences() {
  const context = useContext(Preferences);
  if (!context) throw new Error('AdminPreferencesProvider is required');
  return context;
}
export function AdminPreferenceControls() {
  const { lang, theme, toggleLang, toggleTheme } = useAdminPreferences();
  return <div className="admin-preference-controls"><button type="button" className="admin-language-toggle" onClick={toggleLang} aria-label={lang === 'vi' ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}><Languages size={15} /><span className={lang === 'vi' ? 'selected' : ''}>VI</span><span>/</span><span className={lang === 'en' ? 'selected' : ''}>EN</span></button><button type="button" className="admin-theme-toggle" onClick={toggleTheme} aria-label={lang === 'vi' ? (theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối') : (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></div>;
}
