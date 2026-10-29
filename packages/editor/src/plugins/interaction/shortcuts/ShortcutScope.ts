// packages/editor/src/plugins/interaction/shortcuts/ShortcutScope.ts
/**
 * Portée des raccourcis : décide si une frappe concerne l'éditeur.
 *
 * - Par défaut, une frappe compte si elle vient de l'élément racine de
 *   l'éditeur ou d'un de ses descendants (le focus est dans l'éditeur), ou
 *   d'un élément ajouté à la portée (la scène du développeur) ;
 * - en portée globale, toute frappe du document compte.
 *
 * Un seul écouteur `keydown` par document concerné (celui de la racine et
 * ceux des éléments ajoutés). Pour qu'un clic donne le focus à la racine ou
 * à un élément ajouté, celui qui n'est pas focalisable reçoit
 * `tabindex="-1"`, retiré quand il quitte la portée.
 */

/** `Node.ELEMENT_NODE`, sans dépendre du global `Node`. */
const ELEMENT_NODE = 1;

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const EDITABLE_SELECTOR = '[contenteditable]:not([contenteditable="false"])';

type Listener = (event: KeyboardEvent) => void;

function asElement(target: EventTarget | null): Element | null {
  const node = target as { readonly nodeType?: unknown } | null;
  return node !== null && typeof node === 'object' && node.nodeType === ELEMENT_NODE ? (target as Element) : null;
}

/** Vrai si la frappe vient d'un champ de saisie (où les touches gardent leur sens). */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = asElement(target);
  if (element === null) return false;
  if (EDITABLE_TAGS.has(element.tagName)) return true;
  return (element as HTMLElement).isContentEditable === true || element.closest(EDITABLE_SELECTOR) !== null;
}

function assertElement(element: unknown, operation: string): asserts element is HTMLElement {
  if (asElement(element as EventTarget | null) !== null) return;
  throw new TypeError(`${operation} : un élément HTML est attendu (reçu : ${String(element)}).`);
}

/** Élément de la portée : l'élément et ce qu'il faut défaire à son retrait. */
interface IScopeEntry {
  readonly element: HTMLElement;
  readonly addedTabIndex: boolean;
}

/** Portée des raccourcis d'un éditeur. */
export class ShortcutScope {
  private readonly entries: IScopeEntry[] = [];
  private readonly documents = new Map<Document, number>();
  private global: boolean;
  private destroyed = false;

  /**
   * @param root Élément racine de l'éditeur (toujours dans la portée).
   * @param listener Appelé pour chaque frappe qui concerne l'éditeur.
   * @param global Portée globale au départ.
   */
  constructor(
    root: HTMLElement,
    private readonly listener: Listener,
    global = false
  ) {
    this.global = global;
    this.add(root);
  }

  /** Vrai si la portée est globale. */
  get isGlobal(): boolean {
    return this.global;
  }

  /** Active ou désactive la portée globale. */
  setGlobal(enabled: boolean): void {
    this.global = enabled === true;
  }

  /**
   * Ajoute `element` à la portée ; retourne la fonction qui l'en retire.
   * Ajouter un élément déjà présent est sans effet (son retrait aussi).
   */
  add(element: HTMLElement): () => void {
    assertElement(element, 'addScopeElement');
    if (this.destroyed) throw new Error('addScopeElement : le plugin interaction.shortcuts est détruit.');
    if (this.entries.some((entry) => entry.element === element)) return () => undefined;
    const addedTabIndex = !element.hasAttribute('tabindex') && element.tabIndex < 0;
    if (addedTabIndex) element.setAttribute('tabindex', '-1');
    const entry: IScopeEntry = { element, addedTabIndex };
    this.entries.push(entry);
    this.listen(element.ownerDocument);
    return () => this.remove(entry);
  }

  /** Vrai si une frappe venue de `target` concerne l'éditeur. */
  contains(target: EventTarget | null): boolean {
    if (this.global) return true;
    const element = asElement(target);
    return element !== null && this.entries.some((entry) => entry.element.contains(element));
  }

  /** Retire tous les écouteurs et les `tabindex` ajoutés. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    [...this.entries].forEach((entry) => this.remove(entry));
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.contains(event.target)) this.listener(event);
  };

  private remove(entry: IScopeEntry): void {
    const index = this.entries.indexOf(entry);
    if (index < 0) return;
    this.entries.splice(index, 1);
    if (entry.addedTabIndex && entry.element.getAttribute('tabindex') === '-1') {
      entry.element.removeAttribute('tabindex');
    }
    this.unlisten(entry.element.ownerDocument);
  }

  private listen(doc: Document): void {
    const count = this.documents.get(doc) ?? 0;
    if (count === 0) doc.addEventListener('keydown', this.handleKeyDown);
    this.documents.set(doc, count + 1);
  }

  private unlisten(doc: Document): void {
    const count = this.documents.get(doc) ?? 0;
    if (count > 1) {
      this.documents.set(doc, count - 1);
      return;
    }
    this.documents.delete(doc);
    doc.removeEventListener('keydown', this.handleKeyDown);
  }
}
