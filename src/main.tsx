import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import App from './App';
console.log('%c* There is a man here.', 'color:#d4af37;font-family:monospace;font-size:14px;');
createRoot(document.getElementById('root')!).render(<StrictMode>
    <App />
  </StrictMode>);
