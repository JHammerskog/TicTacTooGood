import { useEffect, useState } from 'react';
import Game from './Game.jsx';
import StartScreen from './StartScreen.jsx';
import ThemeControls from './ThemeControls.jsx';

const DEFAULT_SETTINGS = {
  opponent: 'hotseat',
  teaching: 'hints',
  computerFirst: false,
  critique: true,
};

const THEME_KEY = 'tictactoogood:theme';
const MUTED_KEY = 'tictactoogood:muted';

/** Reads the stored theme, defaulting to dark. Storage can throw in a private
 *  window or when site data is blocked, so a failure falls back rather than
 *  taking the app down. */
function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'dark';
  } catch {
    return 'dark';
  }
}

function storedMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

function App() {
  const [screen, setScreen] = useState('start');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState(storedTheme);
  const [muted, setMuted] = useState(storedMuted);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // A viewer who blocks storage still gets the theme, just not remembered.
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(MUTED_KEY, String(muted));
    } catch {
      // Not remembered; not fatal.
    }
  }, [muted]);

  return (
    <main className="container py-5">
      <ThemeControls
        theme={theme}
        onTheme={setTheme}
        muted={muted}
        onMuted={setMuted}
      />
      {screen === 'start' ? (
        <StartScreen
          settings={settings}
          onChange={setSettings}
          onStart={() => setScreen('game')}
        />
      ) : (
        <Game
          settings={settings}
          onChange={setSettings}
          onQuit={() => setScreen('start')}
          muted={muted}
        />
      )}
    </main>
  );
}

export default App;
