// ============================================================
// INPUT MANAGER — keyboard/mouse input handling
// ============================================================

type InputAction =
  | 'move_up' | 'move_down' | 'move_left' | 'move_right'
  | 'plant' | 'remove' | 'interact' | 'chat';

const KEY_MAP: Record<string, InputAction> = {
  ArrowUp:    'move_up',
  ArrowDown:  'move_down',
  ArrowLeft:  'move_left',
  ArrowRight: 'move_right',
  w: 'move_up',
  a: 'move_left',
  s: 'move_down',
  d: 'move_right',
  W: 'move_up',
  A: 'move_left',
  S: 'move_down',
  D: 'move_right',
  p: 'plant',
  P: 'plant',
  r: 'remove',
  R: 'remove',
  e: 'interact',
  E: 'interact',
  Enter: 'chat',
};

type ActionHandler = (action: InputAction) => void;

export class InputManager {
  private held = new Set<string>();
  private handlers: ActionHandler[] = [];
  private moveRepeat: ReturnType<typeof setInterval> | null = null;
  private suppressKeys = false; // while chat is open

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onAction(handler: ActionHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  setSuppressKeys(suppress: boolean): void {
    this.suppressKeys = suppress;
    if (suppress) {
      this.held.clear();
      this.stopMoveRepeat();
    }
  }

  private fire(action: InputAction): void {
    this.handlers.forEach(h => h(action));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.suppressKeys && e.key !== 'Escape') return;

    const action = KEY_MAP[e.key];
    if (!action) return;

    // Always fire chat open on Enter (not suppressed)
    if (e.key === 'Enter' && !this.suppressKeys) {
      this.fire('chat');
      return;
    }

    // Movement: fire immediately + start repeat
    if (action.startsWith('move_')) {
      e.preventDefault();
      if (!this.held.has(e.key)) {
        this.held.add(e.key);
        this.fire(action);
        this.startMoveRepeat();
      }
      return;
    }

    // Other actions: single fire
    if (!this.held.has(e.key)) {
      this.held.add(e.key);
      this.fire(action);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.key);
    const moveKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D']);
    if (moveKeys.has(e.key)) {
      const anyMoveHeld = [...this.held].some(k => moveKeys.has(k));
      if (!anyMoveHeld) this.stopMoveRepeat();
    }
  };

  private startMoveRepeat(): void {
    if (this.moveRepeat) return;
    this.moveRepeat = setInterval(() => {
      const moveKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
      for (const key of moveKeys) {
        if (this.held.has(key)) {
          const action = KEY_MAP[key];
          if (action) this.fire(action);
          break;
        }
      }
    }, 120);
  }

  private stopMoveRepeat(): void {
    if (this.moveRepeat) {
      clearInterval(this.moveRepeat);
      this.moveRepeat = null;
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.stopMoveRepeat();
  }
}
