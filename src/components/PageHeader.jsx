import React from 'react';

/** Shared page heading; keep navigation and actions with the page they describe. */
const PageHeader = ({ title, description, actions, navigation, className = '' }) => (
  <header className={`app-page__header ${className}`.trim()}>
    {navigation && <div className="app-page__navigation">{navigation}</div>}
    <div className="app-page__header-row">
      <div className="app-page__heading">
        <h1 className="app-page__title">{title}</h1>
        {description && <p className="app-page__subtitle">{description}</p>}
      </div>
      {actions && <div className="app-page__actions">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
