import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { setSystemConfiguration } from '../lib/systemConfiguration';
const Configuration = createContext({ settings: null, error: '', refresh: async () => {} });
export function SystemConfigurationProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { const data = await apiRequest('/system/settings'); setSystemConfiguration(data); setSettings(data); setError(''); }
    catch (error) { setError(error.message); throw error; }
  }, []);
  useEffect(() => {
    const reload = () => { refresh().catch(() => {}); };
    reload(); const timer = window.setInterval(reload, 60000); window.addEventListener('focus', reload);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', reload); };
  }, [refresh]);
  useEffect(() => { if (settings?.general?.systemName) document.title = settings.general.systemName; }, [settings]);
  return <Configuration.Provider value={{ settings, error, refresh }}>{children}</Configuration.Provider>;
}
export const useSystemConfiguration = () => useContext(Configuration);
export function SystemBrandName() {
  const { settings } = useSystemConfiguration();
  return settings?.general?.systemName || 'FlowRequest';
}
export function SystemLogo({ fallback }) {
  const { settings } = useSystemConfiguration();
  return settings?.general?.logoUrl ? <img src={settings.general.logoUrl} alt={settings.general.systemName} className="configured-system-logo" referrerPolicy="no-referrer" /> : fallback;
}
