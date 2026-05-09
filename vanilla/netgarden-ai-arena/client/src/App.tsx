// ============================================================
// APP ROOT — manages boot sequence → game transition
// ============================================================

import React, { useState } from 'react';
import { BootTerminal } from './components/BootTerminal.js';
import { Game } from './components/Game.js';

export const App: React.FC = () => {
  const [booted, setBooted] = useState(false);
  const [showGame, setShowGame] = useState(false);

  const handleBootComplete = () => {
    setBooted(true);
    setTimeout(() => setShowGame(true), 100);
  };

  return (
    <>
      {!booted && <BootTerminal onComplete={handleBootComplete} />}
      {showGame && <Game onBooted={showGame} />}
    </>
  );
};
