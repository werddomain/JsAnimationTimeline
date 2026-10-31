// packages/runtime/src/playback/html/grouping.ts
import type { IHtmlPlaybackGroup, IHtmlPlaybackFrame, HtmlPlaybackDeclarations } from './types';

export interface IHtmlGroupCompilation {
  readonly groups: readonly IHtmlPlaybackGroup[];
  readonly frames: Readonly<Record<string, IHtmlPlaybackFrame>>;
}

function fingerprint(stream: readonly HtmlPlaybackDeclarations[]): string {
  return JSON.stringify(stream.map((frame) => Object.entries(frame).sort(([a], [b]) => a.localeCompare(b))));
}
function uniqueSelector(element: Element, root: ParentNode, supplied?: (element: Element) => string | undefined): string | undefined {
  const escaped = element.id.replace(/[^a-zA-Z0-9_-]/gu, (char) => `\\${char.codePointAt(0)!.toString(16)} `);
  const candidates = [supplied?.(element), element.id === '' ? undefined : `[id="${escaped}"]`];
  return candidates.find((selector) => {
    if (selector === undefined || selector.trim() === '') return false;
    try { const matches = root.querySelectorAll(selector); return matches.length === 1 && matches[0] === element; }
    catch { return false; }
  });
}

/** Membership, not DOM order, determines the stream used by each element. */
export function groupHtmlSnapshots(root: ParentNode, selectors: readonly string[], streams: ReadonlyMap<Element, readonly HtmlPlaybackDeclarations[]>,
  selectorForElement?: (element: Element) => string | undefined): IHtmlGroupCompilation {
  const memberships = new Map<string, Element[]>();
  const matches = selectors.map((selector) => new Set(root.querySelectorAll(selector)));
  for (const element of streams.keys()) {
    const key = JSON.stringify(matches.map((elements) => elements.has(element)));
    memberships.set(key, [...(memberships.get(key) ?? []), element]);
  }
  const groups: IHtmlPlaybackGroup[] = [];
  const frames: Record<string, Record<string, HtmlPlaybackDeclarations>> = Object.create(null) as Record<string, Record<string, HtmlPlaybackDeclarations>>;
  function add(elements: readonly Element[], include: readonly string[], exclude: readonly string[]): void {
    const id = `group-${groups.length + 1}`;
    groups.push({ id, include, exclude, count: elements.length });
    streams.get(elements[0])!.forEach((declarations, index) => {
      const frame = String(index + 1);
      frames[frame] ??= Object.create(null) as Record<string, HtmlPlaybackDeclarations>;
      frames[frame][id] = { ...declarations };
    });
  }
  for (const [key, elements] of memberships) {
    const membership = JSON.parse(key) as boolean[];
    const include = selectors.filter((_, index) => membership[index]);
    const exclude = selectors.filter((_, index) => !membership[index]);
    const first = fingerprint(streams.get(elements[0])!);
    if (elements.every((element) => fingerprint(streams.get(element)!) === first)) add(elements, include, exclude);
    else for (const element of elements) {
      const selector = uniqueSelector(element, root, selectorForElement);
      if (selector === undefined) throw new Error('Ces éléments ont des rendus distincts. Attribuez-leur des ID uniques ou fournissez des sélecteurs uniques pour les exporter.');
      add([element], [...new Set([...include, selector])], exclude);
    }
  }
  return { groups, frames };
}
