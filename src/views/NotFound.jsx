import React from 'react';
import PageHeader from '../components/PageHeader';
import { Button } from '@carbon/react';
import { Home, ArrowLeft } from '@carbon/icons-react';

const NotFound = ({ onNavigate }) => {
  return (
    <div className="app-page app-page--wide">
      <PageHeader
        title="Page not found"
        description="The page you’re looking for doesn’t exist or has been moved."
      />
      <div className="not-found-page">
        <div className="not-found-page__code">
          404
        </div>

        <div className="not-found-page__actions">
          <Button
            renderIcon={Home}
            onClick={() => onNavigate('HOME')}
          >
            Go to Home
          </Button>

          <Button
            kind="secondary"
            renderIcon={ArrowLeft}
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>

        <div className="not-found-page__help">
          <h2 className="not-found-page__help-title">
            Need help?
          </h2>
          <p className="not-found-page__help-copy">
            If you believe this is an error, please contact your system administrator
            or check the application documentation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
