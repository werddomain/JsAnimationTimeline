// packages/editor/src/plugins/layers/selection/keyboardNav.ts
/**
 * Navigation au clavier dans la liste des calques : une touche et l'état des
 * lignes donnent une action. Fonction pure, sans DOM.
 */

/** Ligne vue par la navigation : arbre aplati dans l'ordre d'affichage. */
export interface NavRow {
  readonly id: string;
  readonly parentId?: string;
  readonly isFolder: boolean;
  /** Dossier replié (toujours faux pour un calque). */
  readonly collapsed: boolean;
}

/** Touche pressée, réduite à ce qui compte (Cmd compte comme Ctrl). */
export interface KeyInput {
  readonly key: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

/** Déplacement du focus : remplace la sélection, l'étend depuis l'ancre, ou ne la touche pas. */
export type MoveMode = 'replace' | 'extend' | 'focus';

/**
 * Action demandée. `move` : mettre le focus sur `to` ; `additive` ne sert
 * qu'à `extend` (Ctrl+Maj : la plage s'ajoute à la sélection).
 */
export type NavAction =
  | { readonly kind: 'move'; readonly to: string; readonly mode: MoveMode; readonly additive: boolean }
  | { readonly kind: 'collapse'; readonly id: string }
  | { readonly kind: 'expand'; readonly id: string }
  | { readonly kind: 'toggleRow'; readonly id: string }
  | { readonly kind: 'selectAll' }
  | { readonly kind: 'clear' };

/** État dont dépend l'action. */
export interface NavContext {
  readonly rows: readonly NavRow[];
  /** Ligne courante : celle qui a le focus clavier. */
  readonly current: string | undefined;
  /** Vrai si au moins une ligne est sélectionnée (Échap ne sert à rien sinon). */
  readonly hasSelection: boolean;
}

function move(to: string | undefined, input: KeyInput): NavAction | undefined {
  if (to === undefined) return undefined;
  if (input.shift) return { kind: 'move', to, mode: 'extend', additive: input.ctrl };
  return { kind: 'move', to, mode: input.ctrl ? 'focus' : 'replace', additive: false };
}

function step(delta: 1 | -1, input: KeyInput, context: NavContext): NavAction | undefined {
  const { rows, current } = context;
  const index = rows.findIndex((row) => row.id === current);
  if (index < 0) return move((delta === 1 ? rows[0] : rows[rows.length - 1])?.id, input);
  const clamped = Math.min(rows.length - 1, Math.max(0, index + delta));
  return move(rows[clamped]?.id, input);
}

function horizontal(key: 'ArrowLeft' | 'ArrowRight', context: NavContext): NavAction | undefined {
  const { rows } = context;
  const index = rows.findIndex((row) => row.id === context.current);
  const row = rows[index];
  if (row === undefined) return undefined;
  const plain = { additive: false, mode: 'replace' } as const;
  if (key === 'ArrowLeft') {
    if (row.isFolder && !row.collapsed) return { kind: 'collapse', id: row.id };
    return row.parentId === undefined ? undefined : { kind: 'move', to: row.parentId, ...plain };
  }
  if (!row.isFolder) return undefined;
  if (row.collapsed) return { kind: 'expand', id: row.id };
  const child = rows[index + 1];
  return child?.parentId === row.id ? { kind: 'move', to: child.id, ...plain } : undefined;
}

/**
 * Action de `input`, ou `undefined` si la touche n'est pas gérée (l'appelant
 * laisse alors l'événement tranquille). Haut / Bas / Début / Fin : déplacer
 * (Maj étend depuis l'ancre, Ctrl ne bouge que le focus) ; Gauche / Droite :
 * replier, déplier ou aller au parent / au premier enfant ; Espace : inverser
 * la ligne ; Ctrl+A : tout ; Échap : vider.
 */
export function resolveKey(input: KeyInput, context: NavContext): NavAction | undefined {
  const { key, ctrl, shift, alt } = input;
  if (alt) return undefined;
  const { rows } = context;
  switch (key) {
    case 'ArrowDown':
      return step(1, input, context);
    case 'ArrowUp':
      return step(-1, input, context);
    case 'Home':
      return move(rows[0]?.id, input);
    case 'End':
      return move(rows[rows.length - 1]?.id, input);
    case 'ArrowLeft':
    case 'ArrowRight':
      return ctrl || shift ? undefined : horizontal(key, context);
    case ' ':
    case 'Spacebar':
      return shift || context.current === undefined ? undefined : { kind: 'toggleRow', id: context.current };
    case 'a':
    case 'A':
      return ctrl && !shift ? { kind: 'selectAll' } : undefined;
    case 'Escape':
      return ctrl || shift || !context.hasSelection ? undefined : { kind: 'clear' };
    default:
      return undefined;
  }
}
