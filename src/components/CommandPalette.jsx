import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, useId } from 'react';
import { Modal, Search } from '@carbon/react';
import {
  Home,
  Catalog,
  User,
  Document,
  Settings,
  Add,
  Download,
  Renew,
  Filter,
  Logout,
  Light,
  Keyboard,
  Book,
  Email,
  UserMultiple,
  Return,
  SearchLocate
} from '@carbon/icons-react';

/**
 * Command Palette Component
 * Universal command palette for quick access to all application actions
 * Activated with Ctrl+K
 */
const CommandPalette = ({ 
  open, 
  onClose, 
  userRole,
  currentView,
  onAction 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState([]);
  const pendingAction = useRef(null);
  const launcherRef = useRef(null);
  const resultsRef = useRef(null);
  const paletteId = useId();
  const listId = `${paletteId}-commands`;

  useLayoutEffect(() => {
    if (open) launcherRef.current = document.activeElement;
  }, [open]);

  // Load recent actions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recent_actions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentActions(Array.isArray(parsed) ? [...new Set(parsed.filter(id => typeof id === 'string'))] : []);
      } catch (e) {
        setRecentActions([]);
      }
    }
  }, []);

  // Define all available actions
  const allActions = useMemo(() => {
    const actions = [
      // Navigation
      {
        id: 'nav-home',
        label: 'Go to Home',
        category: 'Navigation',
        icon: Home,
        keywords: ['home', 'dashboard', 'main'],
        action: () => onAction('navigate', 'HOME'),
      },
      {
        id: 'nav-builds',
        label: 'Go to Build Management',
        category: 'Navigation',
        icon: Catalog,
        keywords: ['builds', 'contracts', 'management'],
        action: () => onAction('navigate', 'BUILDS'),
      },
      {
        id: 'nav-users',
        label: 'Go to User Management',
        category: 'Navigation',
        icon: UserMultiple,
        keywords: ['users', 'accounts', 'management'],
        roles: ['ADMIN'],
        action: () => onAction('navigate', 'USERS'),
      },
      {
        id: 'nav-logs',
        label: 'Go to System Logs',
        category: 'Navigation',
        icon: Document,
        keywords: ['logs', 'audit', 'history'],
        roles: ['ADMIN', 'AUDITOR'],
        action: () => onAction('navigate', 'LOGS'),
      },
      {
        id: 'nav-settings',
        label: 'Go to Account Settings',
        category: 'Navigation',
        icon: Settings,
        keywords: ['settings', 'account', 'profile', 'preferences'],
        action: () => onAction('navigate', 'SETTINGS'),
      },

      // Build Actions
      {
        id: 'build-new',
        label: 'Create New Build',
        category: 'Build Actions',
        icon: Add,
        keywords: ['create', 'new', 'build', 'contract'],
        roles: ['ADMIN', 'AUDITOR'],
        context: ['BUILDS'],
        action: () => onAction('createBuild'),
      },
      {
        id: 'build-refresh',
        label: 'Refresh Builds',
        category: 'Build Actions',
        icon: Renew,
        keywords: ['refresh', 'reload', 'update'],
        context: ['BUILDS'],
        action: () => onAction('refreshBuilds'),
      },
      {
        id: 'build-filter',
        label: 'Toggle Filters',
        category: 'Build Actions',
        icon: Filter,
        keywords: ['filter', 'search', 'toggle'],
        context: ['BUILDS'],
        action: () => onAction('toggleFilters'),
      },
      {
        id: 'build-export',
        label: 'Export Selected Builds to CSV',
        category: 'Build Actions',
        icon: Download,
        keywords: ['export', 'download', 'csv'],
        context: ['BUILDS'],
        action: () => onAction('exportBuilds'),
      },

      // User Actions
      {
        id: 'user-new',
        label: 'Create New User',
        category: 'User Actions',
        icon: Add,
        keywords: ['create', 'new', 'user', 'account'],
        roles: ['ADMIN'],
        context: ['USERS'],
        action: () => onAction('createUser'),
      },
      {
        id: 'user-profile',
        label: 'View My Profile',
        category: 'User Actions',
        icon: User,
        keywords: ['profile', 'account', 'me', 'settings'],
        action: () => onAction('navigate', 'SETTINGS'),
      },
      {
        id: 'user-logout',
        label: 'Logout',
        category: 'User Actions',
        icon: Logout,
        keywords: ['logout', 'sign out', 'exit'],
        action: () => onAction('logout'),
      },

      // Settings
      {
        id: 'settings-theme',
        label: 'Toggle Theme',
        category: 'Settings',
        icon: Light,
        keywords: ['theme', 'dark', 'light', 'mode'],
        action: () => onAction('toggleTheme'),
      },
      {
        id: 'settings-shortcuts',
        label: 'View Keyboard Shortcuts',
        category: 'Settings',
        icon: Keyboard,
        keywords: ['shortcuts', 'keyboard', 'help', 'keys'],
        action: () => onAction('showShortcuts'),
      },

      // Help
      {
        id: 'help-docs',
        label: 'Open Documentation',
        category: 'Help',
        icon: Book,
        keywords: ['docs', 'documentation', 'help', 'guide'],
        action: () => onAction('openDocs'),
      },
      {
        id: 'help-support',
        label: 'Contact Support',
        category: 'Help',
        icon: Email,
        keywords: ['support', 'help', 'contact', 'email'],
        action: () => onAction('contactSupport'),
      },
    ];

    // Filter by role and context
    return actions.filter(action => {
      // Check role permission
      if (action.roles && !action.roles.includes(userRole)) {
        return false;
      }
      // Check context (if specified, only show in that view)
      if (action.context && !action.context.includes(currentView)) {
        return false;
      }
      return true;
    });
  }, [userRole, currentView, onAction]);

  // Search the commands available to this role and page.
  const filteredActions = useMemo(() => {
    if (!searchTerm.trim()) {
      return allActions;
    }

    const searchLower = searchTerm.trim().toLowerCase();
    return allActions.filter(action => {
      const labelMatch = action.label.toLowerCase().includes(searchLower);
      const keywordsMatch = action.keywords?.some(keyword => 
        keyword.toLowerCase().includes(searchLower)
      );
      return labelMatch || keywordsMatch;
    });
  }, [allActions, searchTerm]);

  // Get recent actions
  const recentActionItems = useMemo(() => {
    return recentActions
      .map(id => allActions.find(a => a.id === id))
      .filter(Boolean)
      .slice(0, 5);
  }, [recentActions, allActions]);

  const visibleRecentActions = searchTerm.trim() ? [] : recentActionItems;
  const remainingActions = filteredActions.filter(action => !visibleRecentActions.some(recent => recent.id === action.id));
  const displayedActions = [...visibleRecentActions, ...remainingActions];
  const activeIndex = Math.min(selectedIndex, Math.max(0, displayedActions.length - 1));
  const groupedActions = remainingActions.reduce((groups, action) => {
    (groups[action.category] ||= []).push(action);
    return groups;
  }, {});

  // Add action to recent
  const addToRecent = useCallback((actionId) => {
    setRecentActions(prev => {
      const updated = [actionId, ...prev.filter(id => id !== actionId)].slice(0, 10);
      localStorage.setItem('recent_actions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Execute action
  const executeAction = useCallback((action) => {
    if (pendingAction.current) return;
    pendingAction.current = action.id;
    addToRecent(action.id);
    onClose();
    setSearchTerm('');
    setSelectedIndex(0);
  }, [addToRecent, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.isComposing) return;
      const fromSearch = e.target.matches?.('.command-palette__search input');
      const totalActions = displayedActions.length;

      switch (e.key) {
        case 'ArrowDown':
          if (!fromSearch) return;
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, Math.min(prev + 1, totalActions - 1)));
          break;
        case 'ArrowUp':
          if (!fromSearch) return;
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          // Close and clear buttons keep their native Enter behavior.
          if (!fromSearch) return;
          e.preventDefault();
          if (displayedActions[activeIndex]) {
            executeAction(displayedActions[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          setSearchTerm('');
          setSelectedIndex(0);
          break;
      }
    };

    // Carbon Search consumes Escape; capture it so the palette can dismiss.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, displayedActions, activeIndex, executeAction, onClose]);

  // Keep the active option visible while keyboard focus stays in the search.
  useEffect(() => {
    if (!open) return;
    resultsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, searchTerm]);

  // Let the palette close and restore focus before opening another dialog.
  useEffect(() => {
    if (open || !pendingAction.current) return;
    const action = allActions.find(item => item.id === pendingAction.current);
    pendingAction.current = null;
    if (launcherRef.current?.isConnected) launcherRef.current.focus();
    action?.action();
  }, [open, allActions]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [open]);

  const renderAction = (action) => {
    const index = displayedActions.indexOf(action);
    return (
      <CommandPaletteItem
        key={action.id}
        id={`${paletteId}-${action.id}`}
        action={action}
        isSelected={activeIndex === index}
        isCurrent={action.id === `nav-${currentView?.toLowerCase()}`}
        onSelect={() => setSelectedIndex(index)}
        onClick={() => executeAction(action)}
      />
    );
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      passiveModal
      modalHeading="Command palette"
      launcherButtonRef={pendingAction.current ? undefined : launcherRef}
      className="command-palette"
      size="md"
    >
      <div className="command-palette__container">
        <p className="command-palette__description">Find a page or run an action.</p>
        <div className="command-palette__search">
          <Search
            data-modal-primary-focus
            id={`${paletteId}-search`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && displayedActions[activeIndex]
              ? `${paletteId}-${displayedActions[activeIndex].id}`
              : undefined}
            placeholder="Search commands…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            size="lg"
            labelText="Search commands"
            closeButtonLabelText="Clear search"
          />
        </div>

        <div className="command-palette__results" ref={resultsRef}>
          <div id={listId} role="listbox" aria-label="Available commands">
            {visibleRecentActions.length > 0 && (
              <div className="command-palette__section" role="group" aria-labelledby={`${paletteId}-recent`}>
                <h3 id={`${paletteId}-recent`} className="command-palette__section-title">Recent</h3>
                {visibleRecentActions.map(renderAction)}
              </div>
            )}

            {Object.entries(groupedActions).map(([category, actions]) => (
              <div key={category} className="command-palette__section" role="group" aria-labelledby={`${paletteId}-${category.replaceAll(' ', '-')}`}>
                <h3 id={`${paletteId}-${category.replaceAll(' ', '-')}`} className="command-palette__section-title">
                  {category.replace('Actions', 'actions')}
                </h3>
                {actions.map(renderAction)}
              </div>
            ))}
          </div>

          {filteredActions.length === 0 && (
            <div className="command-palette__empty">
              <SearchLocate size={32} aria-hidden="true" />
              <h3>No matching commands</h3>
              <p>Try a page name or an action, such as “build”.</p>
            </div>
          )}
        </div>

        <p className="command-palette__announcement" role="status">
          {open ? `${displayedActions.length} ${displayedActions.length === 1 ? 'command' : 'commands'} available.` : ''}
        </p>
        <div className="command-palette__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Run command</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </Modal>
  );
};

const CommandPaletteItem = ({ id, action, isSelected, isCurrent, onSelect, onClick }) => {
  const Icon = action.icon;

  return (
    <button
      id={id}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      className="command-palette__item"
      aria-label={`${action.label}${isCurrent ? ', current page' : ''}`}
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onMouseMove={onSelect}
      onClick={onClick}
      type="button"
    >
      <Icon size={16} className="command-palette__item-icon" aria-hidden="true" />
      <span className="command-palette__item-label">{action.label}</span>
      {isCurrent && <span className="command-palette__current">Current page</span>}
      <Return size={16} className="command-palette__return" aria-hidden="true" />
    </button>
  );
};

export default CommandPalette;
