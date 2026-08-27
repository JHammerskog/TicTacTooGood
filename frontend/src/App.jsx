import { useEffect, useState } from 'react';
import Game from './Game.jsx';
import Landing from './Landing.jsx';
import LearnList from './LearnList.jsx';
import StartScreen from './StartScreen.jsx';
import ThemeControls from './ThemeControls.jsx';
import Tutorial from './Tutorial.jsx';
import { other } from './game.js';

const DEFAULT_SETTINGS = {
  // Which mark the computer plays, or null for hotseat. `difficulty` is kept
  // even while the computer is off, so switching it on mid-game has a setting
  // to use without asking again.
  computerMark: null,
  difficulty: 'fallible',
  teaching: 'hints',
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

/** Sound is off until asked for: a page that starts making noise is worse than
 *  one that is quiet, and the pencil is a flourish, not information. */
function storedMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function App() {
  const [screen, setScreen] = useState('landing');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState(storedTheme);
  const [muted, setMuted] = useState(storedMuted);
  const [tutorialId, setTutorialId] = useState(null);
  // Session-wide, deliberately not stored: localStorage is per-browser rather
  // than per-person, so a remembered "already seen" would silence the offer for
  // someone who has never seen it. Reloading is the only way to get another.
  const [trapShown, setTrapShown] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // A viewer who blocks storage still gets the theme, just not remembered.
    }
  }, [theme]);

  // Written on change rather than in an effect. An effect also runs on mount,
  // which stamped the default into storage before the listener had chosen
  // anything — so every browser that had ever loaded the app carried an
  // explicit "sound on" that outranked the default and could never be undone
  // by changing the default.
  function changeMuted(next) {
    setMuted(next);
    try {
      localStorage.setItem(MUTED_KEY, String(next));
    } catch {
      // Not remembered; not fatal.
    }
  }

  return (
    <main className="container py-5">
      <ThemeControls
        theme={theme}
        onTheme={setTheme}
        muted={muted}
        onMuted={changeMuted}
      />
      {screen === 'landing' ? (
        <Landing
          onLearn={() => setScreen('tutorials')}
          onPlay={() => setScreen('setup')}
        />
      ) : screen === 'setup' ? (
        <StartScreen
          settings={settings}
          onChange={setSettings}
          onStart={() => setScreen('game')}
          onBack={() => setScreen('landing')}
        />
      ) : screen === 'tutorials' ? (
        <LearnList
          onOpen={(id) => {
            setTutorialId(id);
            setScreen('tutorial');
          }}
          onBack={() => setScreen('landing')}
        />
      ) : screen === 'tutorial' ? (
        // A changed `key` makes React remount rather than re-render, so
        // `phase` and `won` reset with the tutorial. Only the index routes
        // between tutorials today, which unmounts anyway — but a "next
        // tutorial" link would otherwise open the next lesson already in its
        // practice phase with the unlock showing.
        <Tutorial
          key={tutorialId}
          id={tutorialId}
          muted={muted}
          onPlayForReal={(playerMark) => {
            setSettings((previous) => ({
              ...previous,
              computerMark: other(playerMark),
              difficulty: 'fallible',
            }));
            setScreen('game');
          }}
          onQuit={() => setScreen('tutorials')}
        />
      ) : (
        <Game
          settings={settings}
          onChange={setSettings}
          onQuit={() => setScreen('landing')}
          muted={muted}
          trapShown={trapShown}
          onTrapShown={() => setTrapShown(true)}
          onLearnTrap={(id) => {
            setTutorialId(id);
            setScreen('tutorial');
          }}
        />
      )}
    </main>
  );
}

export default App;
