import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import './ui/styles.css';
import { App } from './ui/App';
import { createRuntime } from './runtime';

const runtime = createRuntime();
// Sound starts on the first click or key press (browser autoplay rules).
runtime.audio.attach(document);

if (import.meta.env.DEV) {
  // Handy in the browser console: __rt.game.getState(), __rt.game.dispatch({...})
  (window as unknown as { __rt: typeof runtime }).__rt = runtime;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App rt={runtime} />
  </StrictMode>,
);
