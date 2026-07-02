import React from 'react';
import ReactDOM from 'react-dom/client';
import { App5e } from '../views/app-5e';
import '../shared/styles.css';
import '../../plugins/index';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App5e />
  </React.StrictMode>
);
