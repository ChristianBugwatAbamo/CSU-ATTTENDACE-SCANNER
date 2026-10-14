import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { UnitProvider } from './context/UnitContext.jsx';
import { AcademicTermProvider } from './context/AcademicTermContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <UnitProvider>
        <AcademicTermProvider>
          <App />
        </AcademicTermProvider>
      </UnitProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
