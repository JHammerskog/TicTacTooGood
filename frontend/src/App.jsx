import { useState } from 'react';
import Game from './Game.jsx';
import StartScreen from './StartScreen.jsx';

const DEFAULT_SETTINGS = {
  opponent: 'hotseat',
  teaching: 'hints',
  computerFirst: false,
};

function App() {
  const [screen, setScreen] = useState('start');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  return (
    <main className="container py-5">
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
        />
      )}
    </main>
  );
}

export default App;
