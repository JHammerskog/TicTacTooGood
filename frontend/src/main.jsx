import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import App from './App.jsx';

// Applied before the first paint; App's effect keeps it in step afterwards.
try {
  document.documentElement.setAttribute(
    'data-bs-theme',
    localStorage.getItem('tictactoogood:theme') ?? 'dark',
  );
} catch {
  document.documentElement.setAttribute('data-bs-theme', 'dark');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
