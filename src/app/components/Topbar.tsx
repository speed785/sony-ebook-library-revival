import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { DrawerView } from "../../types";

type TopbarProps = {
  navCollapsed: boolean;
  detailsCollapsed: boolean;
  drawerView: DrawerView;
  onToggleNav: () => void;
  onToggleDetails: () => void;
  onRefresh: () => void;
};

export function Topbar({
  navCollapsed,
  detailsCollapsed,
  drawerView,
  onToggleNav,
  onToggleDetails,
  onRefresh,
}: TopbarProps) {
  return (
    <header className="app-topbar">
      <div>
        <p className="eyebrow">Sony eBook Library Revival</p>
        <h1>Reader manager</h1>
      </div>
      <div className="topbar-actions">
        <button
          className="secondary icon-button"
          type="button"
          onClick={onToggleNav}
        >
          {navCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
        <button
          className="secondary icon-button"
          type="button"
          onClick={onToggleDetails}
          disabled={drawerView.kind === "closed"}
        >
          {detailsCollapsed ? (
            <PanelRightOpen size={18} />
          ) : (
            <PanelRightClose size={18} />
          )}
        </button>
        <button className="secondary" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>
    </header>
  );
}
