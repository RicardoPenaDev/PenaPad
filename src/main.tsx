import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { api } from './api';
import { setTestStorage } from './storage';

// Descobre antes de desenhar se é a cópia de testes, para ler as preferências certas
api.debugEnabled()
  .then((on) => setTestStorage(on), () => setTestStorage(false))
  .finally(() => createRoot(document.getElementById('root')!).render(<App />));
