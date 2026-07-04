// Runtime loads Phaser 3.90 via CDN in index.html; no npm import needed.
declare const Phaser: any;

declare global {
  interface Window {
    game: any;
  }
}

const DESIGN_WIDTH = 540;
const DESIGN_HEIGHT = 960;

const config: any = {
  type: Phaser.AUTO,
  parent: 'game',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#0A0E1A',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  fps: { target: 60 },
  render: { antialias: true, powerPreference: 'high-performance' },
};

function createGame(): any {
  return new Phaser.Game(config);
}

// Re-export for global scripts loaded in index.html.
(window as any).NeonCreateGame = createGame;

// Bootstrap when DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createGame);
} else {
  createGame();
}

export { createGame, config };
