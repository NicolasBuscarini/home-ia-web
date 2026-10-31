import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import App from './App';
import { applyTheme, readSavedTheme } from './theme/theme';

applyTheme(readSavedTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz do aplicativo não encontrado.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
