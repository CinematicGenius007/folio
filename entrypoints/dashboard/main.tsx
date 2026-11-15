import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/theme.css';
import { Dashboard } from '@/components/dashboard/Dashboard';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
);
