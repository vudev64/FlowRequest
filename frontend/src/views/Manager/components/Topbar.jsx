
import { ChevronRight, Menu, Moon, Sun } from "lucide-react";

export function Topbar({ isDark, onToggleDark, onOpenMenu }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button mobile-menu"
        onClick={onOpenMenu}
        aria-label="Mở điều hướng"
      >
        <Menu size={20} />
      </button>

      <div className="crumb">
        <span>Workspace</span>
        <ChevronRight size={14} />
        <strong>Manager</strong>
      </div>

      <div className="topbar-actions">
        <div className="live-pill"></div>
        
        <button
          type="button"
          className="icon-button"
          onClick={onToggleDark}
          aria-label="Đổi giao diện"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="topbar-avatar">MA</div>
      </div>
    </header>
  );
}
