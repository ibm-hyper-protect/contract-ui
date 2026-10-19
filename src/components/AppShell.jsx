import React, { useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderMenuButton,
  Theme,
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenuItem,
  SideNavMenu,
  Modal,
  MenuButton,
  MenuItem
} from '@carbon/react';
import {
  Settings,
  Logout,
  UserAvatar,
  UserAdmin,
  Application,
  DataBase,
  Security,
  CloudApp,
  View,
  Home,
  Catalog,
  ChartLine,
  UserMultiple,
  DocumentTasks,
  Help
} from '@carbon/icons-react';
import DesktopTitleBar from './DesktopTitleBar';
import FeatureHelp from './FeatureHelp';
import { getRoleLabel, sortRolesByPriority } from '../utils/roles';

const AppShell = ({
  activeNav,
  setActiveNav,
  onLogout,
  userRole,
  userRoles = [],
  userEmail,
  onRoleChange,
  children
}) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [showFeatureHelp, setShowFeatureHelp] = useState(false);

  const handleLogoutClick = () => setShowLogoutModal(true);
  const confirmLogout = () => { setShowLogoutModal(false); onLogout(); };

  const availableRoles = sortRolesByPriority(
    Array.from(new Set((userRoles.length > 0 ? userRoles : [userRole]).filter(Boolean)))
  );
  const activeRole = userRole;
  const isAdmin = activeRole === 'ADMIN';
  const isAuditor = activeRole === 'AUDITOR';
  const canViewAnalytics = isAdmin;
  const canViewUsers = isAdmin;
  const canViewLogs = isAdmin || isAuditor;
  const hasAdminOperations = canViewAnalytics || canViewUsers || canViewLogs;

  const getUsername = (email) => {
    if (!email) return 'User';
    return email.split('@')[0].replace(/\./g, ' ').split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getPersonaIcon = (role) => {
    const icons = {
      ADMIN: UserAdmin,
      SOLUTION_PROVIDER: Application,
      DATA_OWNER: DataBase,
      AUDITOR: Security,
      ENV_OPERATOR: CloudApp,
      VIEWER: View,
    };
    const Icon = icons[role] || UserAvatar;
    return <Icon size={20} />;
  };

  const handleRoleChange = (nextRole) => {
    if (!nextRole || nextRole === activeRole || typeof onRoleChange !== 'function') return;
    onRoleChange(nextRole);
  };

  return (
    <>
      <Theme theme="g100">
        <DesktopTitleBar zIndex={10000} showConnectionStatus enableConnectionWatcher />

        <Header aria-label="IBM Confidential Computing Contract UI" className="app-shell-header">
          <HeaderMenuButton
            aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
            onClick={() => setIsSideNavExpanded(!isSideNavExpanded)}
            isActive={isSideNavExpanded}
            className="app-shell-no-drag"
          />
          <HeaderName href="#" prefix="IBM" className="app-shell-no-drag">
            <span className="app-shell-header-title">Confidential Computing Contract UI v1.0</span>
          </HeaderName>
          <HeaderGlobalBar className="app-shell-header-global">
            <div className="app-shell-user-chip app-shell-no-drag">
              <div className="app-shell-user-chip__avatar">
                {getPersonaIcon(activeRole)}
              </div>
              <span className="app-shell-user-chip__name" title={userEmail}>
                {getUsername(userEmail)}
              </span>
              <MenuButton
                kind="ghost"
                size="sm"
                label={getRoleLabel(activeRole)}
                menuAlignment="bottom-end"
                className="app-shell-role-menu-button"
                disabled={availableRoles.length <= 1}
              >
                {availableRoles.map((role) => (
                  <MenuItem
                    key={role}
                    label={`${getRoleLabel(role)}${role === activeRole ? ' (Current)' : ''}`}
                    disabled={role === activeRole}
                    onClick={() => handleRoleChange(role)}
                  />
                ))}
              </MenuButton>
            </div>
          </HeaderGlobalBar>
        </Header>

        {/* Mobile overlay — dims content and closes nav on tap */}
        {isSideNavExpanded && (
          <div
            className="app-shell-sidenav-overlay"
            onClick={() => setIsSideNavExpanded(false)}
            aria-hidden="true"
          />
        )}

        <SideNav
          isFixedNav
          expanded={isSideNavExpanded}
          isChildOfHeader={true}
          aria-label="Side navigation"
          className="app-shell-sidenav"
        >
          <SideNavItems className="app-shell-sidenav-items">

            <SideNavLink
              renderIcon={Home}
              isActive={activeNav === 'HOME'}
              href="#home"
              onClick={(e) => { e.preventDefault(); setActiveNav('HOME'); }}
            >
              Home
            </SideNavLink>

            <SideNavLink
              renderIcon={Catalog}
              isActive={activeNav === 'BUILDS'}
              href="#builds"
              onClick={(e) => { e.preventDefault(); setActiveNav('BUILDS'); }}
            >
              Build Management
            </SideNavLink>

            {/* SideNavMenu groups use SideNavMenuItem for sub-items (no icon) */}
            {hasAdminOperations && (
              <SideNavMenu renderIcon={ChartLine} title="Admin Operations" defaultExpanded>
                {canViewAnalytics && (
                  <SideNavMenuItem
                    isActive={activeNav === 'ANALYTICS'}
                    onClick={() => setActiveNav('ANALYTICS')}
                  >
                    Diagnostics & Analytics
                  </SideNavMenuItem>
                )}
                {canViewUsers && (
                  <SideNavMenuItem
                    isActive={activeNav === 'USERS'}
                    onClick={() => setActiveNav('USERS')}
                  >
                    User Management
                  </SideNavMenuItem>
                )}
                {canViewLogs && (
                  <SideNavMenuItem
                    isActive={activeNav === 'LOGS'}
                    onClick={() => setActiveNav('LOGS')}
                  >
                    System Logs
                  </SideNavMenuItem>
                )}
              </SideNavMenu>
            )}

            {/* Pushes account menu to bottom */}
            <div className="app-shell-sidenav-spacer" />

            <div className="app-shell-account-menu">
              <SideNavMenu renderIcon={Settings} title="Account">
                <SideNavMenuItem onClick={() => setActiveNav('SETTINGS')}>
                  Settings
                </SideNavMenuItem>
                <SideNavMenuItem onClick={() => setShowFeatureHelp(true)}>
                  Feature Help
                </SideNavMenuItem>
                <SideNavMenuItem onClick={handleLogoutClick}>
                  Logout
                </SideNavMenuItem>
              </SideNavMenu>
            </div>

          </SideNavItems>
        </SideNav>
      </Theme>

      <main className={`app-shell-main ${isSideNavExpanded ? 'app-shell-main--expanded' : 'app-shell-main--collapsed'}`}>
        <div className="app-shell-content">
          {children}
        </div>
        <footer className="app-shell-footer">
          Powered by IBM Confidential Computing
        </footer>
      </main>

      <Modal
        open={showLogoutModal}
        modalHeading="Confirm Logout"
        primaryButtonText="Logout"
        secondaryButtonText="Cancel"
        onRequestClose={() => setShowLogoutModal(false)}
        onRequestSubmit={confirmLogout}
        danger
      >
        <p>Are you sure you want to logout? Any unsaved changes will be lost.</p>
      </Modal>

      <FeatureHelp
        open={showFeatureHelp}
        onClose={() => setShowFeatureHelp(false)}
      />
    </>
  );
};

export default AppShell;
