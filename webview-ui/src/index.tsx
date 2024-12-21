import { StrictMode } from 'react';
import 'reactflow/dist/style.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
