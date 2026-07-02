import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppBuilder } from '../views/builder-5e';
import '../shared/styles.css';
import '../../plugins/index';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppBuilder />
  </React.StrictMode>
);
