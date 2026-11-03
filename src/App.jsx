import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AppShell from './components/AppShell';
import Home from './views/Home';
import BuildManagement from './views/BuildManagement';
import BuildDetails from './views/BuildDetails';
import AdminAnalytics from './views/AdminAnalytics';
import UserManagement from './views/UserManagement';
import AccountSettings from './views/AccountSettings';
import SystemLogs from './views/SystemLogs';
import Login from './views/Login';
import NotFound from './views/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastManager';
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp';
import CommandPalette from './components/CommandPalette';
import { PageCommandContext } from './hooks/usePageCommand';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { PERSONAS } from './store/mockData';
import buildService from './services/buildService';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { useConfigStore } from './store/configStore';
import apiClient from './services/apiClient';
import { getPrimaryRole, ROLE_LABELS } from './utils/roles';
import { ProgressBar, Theme, Modal, InlineNotification } from '@carbon/react';
import '@carbon/charts/styles.css';

const ROLE_PERSONA_MAP = {
  'ADMIN': PERSONAS.ADMIN,
  'SOLUTION_PROVIDER': PERSONAS.SOLUTION_PROVIDER,
  'DATA_OWNER': PERSONAS.DATA_OWNER,
  'AUDITOR': PERSONAS.AUDITOR,
  'ENV_OPERATOR': PERSONAS.ENV_OPERATOR,
  'VIEWER': PERSONAS.VIEWER
};

const normalizeRoles = (roles = []) => {
  if (!Array.isArray(roles)) return [];

  return Array.from(
    new Set(
      roles
        .map((role) => (typeof role === 'string' ? role : (role?.role_name || role?.name || '')))
        .filter(Boolean)
    )
  );
};

const getSafeStoredRoles = (rolesJson, role) => {
  if (!rolesJson) return role ? [role] : ['VIEWER'];
  try {
    const parsed = JSON.parse(rolesJson);
    const normalized = normalizeRoles(parsed);
    return normalized.length > 0 ? normalized : (role ? [role] : ['VIEWER']);
  } catch {
    return role ? [role] : ['VIEWER'];
  }
};

function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [pageCommand, setPageCommand] = useState(null);
  const [commandError, setCommandError] = useState(null);
  const commandSequence = useRef(0);
  const toggleTheme = useThemeStore(state => state.toggleTheme);
  const handlePageCommandHandled = useCallback(id => {
    setPageCommand(current => current?.id === id ? null : current);
  }, []);
  const pageCommandContext = useMemo(() => ({ command: pageCommand, onHandled: handlePageCommandHandled }), [pageCommand, handlePageCommandHandled]);
  const [userRole, setUserRole] = useState('ADMIN');
  const [userRoles, setUserRoles] = useState(['ADMIN']);
  const [userEmail, setUserEmail] = useState('');

  const [activePersona, setActivePersona] = useState(PERSONAS.ADMIN);
  const [activeNav, setActiveNav] = useState('HOME'); // Default to home for all users
  const [builds, setBuilds] = useState([]);
  const [selectedBuildId, setSelectedBuildId] = useState(null);
  const setupRequired = useAuthStore((state) => state.isSetupRequired());
  const serverUrl = useConfigStore((state) => state.serverUrl);
  const hydrateConfig = useConfigStore((state) => state.hydrateConfig);
  const applyExternalConfig = useConfigStore((state) => state.applyExternalConfig);

  const resetAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole('ADMIN');
    setUserRoles(['ADMIN']);
    setUserEmail('');
    setActivePersona(PERSONAS.ADMIN);
    setActiveNav('HOME');
    setBuilds([]);
    setSelectedBuildId(null);
    setShowWelcomeModal(false);
    setShowCommandPalette(false);
    setPageCommand(null);
    setCommandError(null);
  }, []);

  const applyStoredAuthState = useCallback(({ role, rolesJson, email }) => {
    const roles = getSafeStoredRoles(rolesJson, role);
    const primaryRole = getPrimaryRole(roles);
    const effectiveRole = roles.includes(role) ? role : primaryRole;

    setUserRoles(roles);
    setUserRole(effectiveRole);
    setActivePersona(ROLE_PERSONA_MAP[effectiveRole] || PERSONAS.ADMIN);
    setActiveNav('HOME');
    setUserEmail(email || '');
  }, []);

  useEffect(() => {
    // Track the current renderer session without clearing persisted app configuration.
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', Date.now().toString());
    }

    // Initial Auth Check
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role');
    const rolesJson = localStorage.getItem('user_roles');
    const email = localStorage.getItem('user_email');

    if (token) {
      setIsAuthenticated(true);
      applyStoredAuthState({ role, rolesJson, email });
    }
  }, [applyStoredAuthState]);

  useEffect(() => {
    hydrateConfig().catch((error) => {
      console.error('Failed to hydrate Electron app config:', error);
    });

    if (window.electron?.appConfig?.onChanged) {
      return window.electron.appConfig.onChanged((config) => {
        applyExternalConfig(config);
      });
    }

    return undefined;
  }, [applyExternalConfig, hydrateConfig]);

  useEffect(() => {
    if (serverUrl) {
      apiClient.setBaseURL(serverUrl);
    }
  }, [serverUrl]);

  useEffect(() => {
    const onForcedLogout = () => {
      resetAuthState();
    };

    window.addEventListener('auth:forced-logout', onForcedLogout);
    return () => window.removeEventListener('auth:forced-logout', onForcedLogout);
  }, [resetAuthState]);

  useEffect(() => {
    const onSessionUpdated = (event) => {
      const detail = event?.detail || {};
      const roleFromStorage = detail.role || localStorage.getItem('user_role');
      const rolesJson = detail.rolesJson || localStorage.getItem('user_roles');
      const email = detail.email || localStorage.getItem('user_email') || '';
      const roles = getSafeStoredRoles(rolesJson, roleFromStorage);
      const nextRole = roles.includes(roleFromStorage) ? roleFromStorage : getPrimaryRole(roles);

      setUserRoles(roles);
      setUserRole(nextRole);
      setActivePersona(ROLE_PERSONA_MAP[nextRole] || PERSONAS.VIEWER);
      setUserEmail(email);
      setSelectedBuildId(null);
      setPageCommand(null);

      const canAccessAnalytics = nextRole === 'ADMIN';
      const canAccessUsers = nextRole === 'ADMIN';
      const canAccessLogs = nextRole === 'ADMIN' || nextRole === 'AUDITOR';
      const blockedAdminPage =
        (activeNav === 'ANALYTICS' && !canAccessAnalytics) ||
        (activeNav === 'USERS' && !canAccessUsers) ||
        (activeNav === 'LOGS' && !canAccessLogs);

      if (blockedAdminPage) {
        setActiveNav('HOME');
      }
    };

    window.addEventListener('auth:session-updated', onSessionUpdated);
    return () => window.removeEventListener('auth:session-updated', onSessionUpdated);
  }, [activeNav]);

  const loadBuilds = useCallback(async () => {
    if (setupRequired) {
      setBuilds([]);
      return;
    }
    const token = useAuthStore.getState().token;
    if (!token) {
      setBuilds([]);
      return;
    }
    try {
      const builds = await buildService.getBuilds();
      setBuilds(builds || []);
    } catch (error) {
      console.error('Failed to load builds:', error);
      setBuilds([]);
    }
  }, [setupRequired]);

  // Load builds when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadBuilds();
    }
  }, [isAuthenticated, loadBuilds]);

  useEffect(() => {
    if (setupRequired && activeNav !== 'SETTINGS') {
      setActiveNav('SETTINGS');
    }
  }, [setupRequired, activeNav]);

  useEffect(() => {
    if (!isBooting) return;
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress > 100) progress = 100;
      
      setBootProgress(progress);

      if (progress === 100) {
        clearInterval(interval);
        setTimeout(() => setIsBooting(false), 500); 
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isBooting]);

  const advanceBuildState = useCallback((buildId, newState) => {
    setBuilds(prev => prev.map(b => 
      b.id === buildId ? { ...b, status: newState } : b
    ));
  }, []);

  const handleLogin = useCallback((isFreshLogin) => {
    const role = localStorage.getItem('user_role');
    const rolesJson = localStorage.getItem('user_roles');
    const email = localStorage.getItem('user_email');

    setIsAuthenticated(true);
    applyStoredAuthState({ role, rolesJson, email });
    if (isFreshLogin) setShowWelcomeModal(true);
  }, [applyStoredAuthState]);

  const handleLogout = useCallback(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    resetAuthState();
  }, [resetAuthState]);

  const handleRoleChange = useCallback((nextRole) => {
    if (!nextRole || !userRoles.includes(nextRole)) return;

    localStorage.setItem('user_role', nextRole);
    setUserRole(nextRole);
    setActivePersona(ROLE_PERSONA_MAP[nextRole] || PERSONAS.VIEWER);
    setSelectedBuildId(null);
    setPageCommand(null);

    const canAccessAnalytics = nextRole === 'ADMIN';
    const canAccessUsers = nextRole === 'ADMIN';
    const canAccessLogs = nextRole === 'ADMIN' || nextRole === 'AUDITOR';
    const blockedAdminPage =
      (activeNav === 'ANALYTICS' && !canAccessAnalytics) ||
      (activeNav === 'USERS' && !canAccessUsers) ||
      (activeNav === 'LOGS' && !canAccessLogs);

    if (blockedAdminPage) {
      setActiveNav('HOME');
    }
  }, [activeNav, userRoles]);

  const selectedBuild = useMemo(
    () => builds.find(b => b.id === selectedBuildId),
    [builds, selectedBuildId]
  );
  const handleSelectBuild = useCallback((buildId) => setSelectedBuildId(buildId), []);
  const handleBackToBuilds = useCallback(() => setSelectedBuildId(null), []);

  const activeView = useMemo(() => {
    if (activeNav === 'HOME') {
      return (
        <Home
        userEmail={userEmail}
        userRole={userRole}
        onNavigate={setActiveNav}
        onSelectBuild={handleSelectBuild}
        />
      );
    }
    if (activeNav === 'ANALYTICS') return <AdminAnalytics />;
    if (activeNav === 'USERS') return <UserManagement />;
    if (activeNav === 'LOGS') return <SystemLogs />;
    if (activeNav === 'SETTINGS') return <AccountSettings />;
    
    if (activeNav === 'BUILDS') {
       if (selectedBuildId && selectedBuild) {
          return (
            <BuildDetails
              build={selectedBuild}
              onBack={handleBackToBuilds}
              activePersona={activePersona}
              userRole={userRole}
              advanceBuildState={advanceBuildState}
            />
          );
       }
       return <BuildManagement builds={builds} onSelectBuild={handleSelectBuild} userRole={userRole} onBuildCreated={loadBuilds} />;
    }
    
    // Default to 404 page for unknown routes
    return <NotFound onNavigate={setActiveNav} />;
  }, [
    activeNav,
    userEmail,
    userRole,
    selectedBuildId,
    selectedBuild,
    activePersona,
    userRoles,
    builds,
    loadBuilds,
    advanceBuildState,
    handleBackToBuilds,
    handleSelectBuild
  ]);

  // Commands request page actions after the destination view has mounted.
  const handleCommandPaletteAction = useCallback((actionType, payload) => {
    const requestPageAction = (view, type) => {
      if (setupRequired) return;
      if (view === 'BUILDS') setSelectedBuildId(null);
      setActiveNav(view);
      setPageCommand({ id: ++commandSequence.current, type });
    };
    const openProjectLink = async (url) => {
      try {
        await window.electron.shell.openExternal(url);
      } catch {
        setCommandError('The link could not be opened. Please try again.');
      }
    };

    switch (actionType) {
      case 'navigate':
        setPageCommand(null);
        setActiveNav(payload);
        break;
      case 'createBuild':
        if (userRole === 'ADMIN' || userRole === 'AUDITOR') requestPageAction('BUILDS', actionType);
        break;
      case 'refreshBuilds':
        loadBuilds();
        break;
      case 'toggleFilters':
      case 'exportBuilds':
        requestPageAction('BUILDS', actionType);
        break;
      case 'createUser':
        if (userRole === 'ADMIN') requestPageAction('USERS', actionType);
        break;
      case 'logout':
        handleLogout();
        break;
      case 'toggleTheme':
        toggleTheme();
        break;
      case 'showShortcuts':
        setShowShortcutsHelp(true);
        break;
      case 'openDocs':
        openProjectLink('https://github.com/ibm-hyper-protect/contract-ui#readme');
        break;
      case 'contactSupport':
        openProjectLink('https://github.com/ibm-hyper-protect/contract-ui/issues/new/choose');
        break;
      default:
        console.warn('Unknown command palette action:', actionType);
    }
  }, [loadBuilds, handleLogout, setupRequired, userRole, toggleTheme]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    // Command palette
    'Ctrl+k': (e) => {
      if (isAuthenticated) {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    },
    
    // Navigation shortcuts
    'Alt+1': () => isAuthenticated && setActiveNav('HOME'),
    'Alt+2': () => isAuthenticated && setActiveNav('BUILDS'),
    'Alt+3': () => isAuthenticated && userRole === 'ADMIN' && setActiveNav('USERS'),
    'Alt+4': () => isAuthenticated && (userRole === 'ADMIN' || userRole === 'AUDITOR') && setActiveNav('LOGS'),
    
    // Help shortcut
    'Shift+?': () => isAuthenticated && setShowShortcutsHelp(true),
    
    // Refresh shortcut
    'Ctrl+r': (e) => {
      if (isAuthenticated && activeNav === 'BUILDS') {
        e.preventDefault();
        loadBuilds();
      }
    },
    
    // Close modal shortcut
    'Escape': () => {
      if (showWelcomeModal) setShowWelcomeModal(false);
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      if (showCommandPalette) setShowCommandPalette(false);
    }
  }, isAuthenticated, [isAuthenticated, userRole, activeNav, showWelcomeModal, showShortcutsHelp, showCommandPalette, loadBuilds, handleLogout]);

  const welcomeMessage = useMemo(
    () => `Welcome Back, ${ROLE_LABELS[userRole] || 'User'}`,
    [userRole]
  );

  if (isBooting) {
    return (
      <Theme theme="g100">
        <div className="app-boot-screen">
          <h1 className="app-boot-screen__title">IBM <br /> Confidential Computing Contract UI</h1>
          <div className="app-boot-screen__progress">
            <ProgressBar label="Loading" value={bootProgress} max={100} />
          </div>
        </div>
      </Theme>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShell
           activeNav={activeNav}
           setActiveNav={setActiveNav}
           onLogout={handleLogout}
           userRole={userRole}
           userRoles={userRoles}
           userEmail={userEmail}
           onRoleChange={handleRoleChange}
        >
          <Modal
            open={showWelcomeModal}
            modalHeading={welcomeMessage}
            primaryButtonText="Get Started"
            onRequestSubmit={() => setShowWelcomeModal(false)}
            onRequestClose={() => setShowWelcomeModal(false)}
          >
            <p className="app-welcome-copy">
              You have successfully authenticated into the IBM Confidential Computing Contract UI. Your cryptographic identity has been verified and active workflows are ready for review.
            </p>
          </Modal>
          
          <KeyboardShortcutsHelp
            open={showShortcutsHelp}
            onClose={() => setShowShortcutsHelp(false)}
          />
          
          <CommandPalette
            open={showCommandPalette}
            onClose={() => setShowCommandPalette(false)}
            userRole={userRole}
            currentView={activeNav}
            onAction={handleCommandPaletteAction}
          />
          
          {commandError && (
            <InlineNotification
              kind="error"
              title="Unable to open link"
              subtitle={commandError}
              lowContrast
              onCloseButtonClick={() => setCommandError(null)}
            />
          )}
          <PageCommandContext.Provider value={pageCommandContext}>
            {activeView}
          </PageCommandContext.Provider>
        </AppShell>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
