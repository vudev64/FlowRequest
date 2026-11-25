import { Zap } from 'lucide-react';
import { SystemBrandName, SystemLogo } from '../../views/SystemConfiguration';

export function BrandLogo({ tone = 'dark', compact = false }) {
  const isDarkSurface = tone === 'dark';

  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup--compact' : ''}`}>
      <span className={`brand-mark ${isDarkSurface ? 'brand-mark--dark' : 'brand-mark--light'}`} aria-hidden="true">
        <SystemLogo fallback={<Zap size={compact ? 16 : 18} strokeWidth={2.8} />} />
      </span>
      <span className={`brand-name ${isDarkSurface ? 'brand-name--dark' : 'brand-name--light'}`}><SystemBrandName /></span>
      <span className={`brand-badge ${isDarkSurface ? 'brand-badge--dark' : 'brand-badge--light'}`}>INTERNAL</span>
    </div>
  );
}
