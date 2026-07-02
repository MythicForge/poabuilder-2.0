import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppGm } from '../views/gm-view';
import '../shared/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppGm />
  </React.StrictMode>
);
