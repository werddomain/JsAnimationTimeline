// packages/runtime/src/playback/html/htmlPlaybackFactory.ts
import type { IInlineStyleKeeper } from '../../stage/html/inlineStyles';
import type { IHtmlPlaybackDocument, IHtmlPlaybackPlayer, IHtmlPlaybackPlayerOptions } from './types';

/** Self-contained closure: emitted verbatim after TypeScript/bundler compilation, with no captured imports. */
export function htmlPlaybackFactory(data: IHtmlPlaybackDocument, options: IHtmlPlaybackPlayerOptions,
  createKeeper: () => IInlineStyleKeeper): IHtmlPlaybackPlayer {
  const root = options.root;
  const node = root as ParentNode & Node;
  const document = (node.nodeType === 9 ? node : node.ownerDocument) as Document | null;
  const view = document?.defaultView;
  const clock = options.clock ?? {
    now: () => view!.performance.now(),
    requestFrame: (callback: () => void) => view!.requestAnimationFrame(callback),
    cancelFrame: (handle: number) => view!.cancelAnimationFrame(handle)
  };
  if (options.clock === undefined && (view === null || view === undefined || typeof view.requestAnimationFrame !== 'function')) throw new Error('Une horloge de lecture est requise.');
  if (!Number.isFinite(clock.now())) throw new Error('L’horloge de lecture est invalide.');
  const duration = data.source.totalFrames * 1000 / data.source.fps;
  let speed = options.speed ?? 1;
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('La vitesse de lecture doit être positive.');
  let loop = options.loop ?? false;
  if (typeof loop !== 'boolean' || options.autoplay !== undefined && typeof options.autoplay !== 'boolean') throw new Error('Les options de lecture sont invalides.');
  let time = 0;
  let started = 0;
  let playing = false;
  let destroyed = false;
  let handle: number | undefined;
  const keeper = createKeeper();
  let members = new Map<string, readonly Element[]>();
  const held = new Set<Element>();
  const written = new Map<Element, ReadonlySet<string>>();

  function resolve(): Map<string, readonly Element[]> {
    const selections = new Map<string, Set<Element>>();
    const query = (selector: string): Set<Element> => {
      let result = selections.get(selector);
      if (result === undefined) { result = new Set(root.querySelectorAll(selector)); selections.set(selector, result); }
      return result;
    };
    const all = new Set<Element>();
    const resolved = new Map<string, readonly Element[]>();
    for (const group of data.groups) {
      const elements = [...query(group.include[0])].filter((element) => group.include.every((selector) => query(selector).has(element)) &&
        !group.exclude.some((selector) => query(selector).has(element)));
      if (elements.length !== group.count) throw new Error('Les cibles HTML ont changé. Recompilez l’animation pour cette scène.');
      for (const element of elements) {
        const style = (element as Partial<ElementCSSInlineStyle>).style;
        if (all.has(element) || style === undefined || typeof style.setProperty !== 'function') throw new Error('Les groupes HTML se recouvrent ou leur cible est incompatible.');
        all.add(element);
      }
      resolved.set(group.id, elements);
    }
    for (const object of Object.values(data.source.objects)) {
      if (object.target === undefined || !('selector' in object.target)) throw new Error('La cible HTML est invalide.');
      for (const element of query(object.target.selector)) if (!all.has(element)) throw new Error('Une nouvelle correspondance HTML n’est pas couverte. Recompilez l’animation.');
    }
    return resolved;
  }
  function integerFrame(): number { return Math.min(data.source.totalFrames, Math.max(1, 1 + Math.floor(time * data.source.fps / 1000 + 1e-6))); }
  function assertAlive(): void { if (destroyed) throw new Error('Le lecteur HTML est détruit.'); }
  function draw(): void {
    const next = resolve(); // Validate every target before the first write.
    const present = new Set([...next.values()].flat());
    for (const element of held) if (!present.has(element)) { keeper.release(element); held.delete(element); written.delete(element); }
    for (const element of present) if (!held.has(element)) { keeper.acquire(element); held.add(element); }
    members = next;
    const frame = data.frames[String(integerFrame())];
    for (const group of data.groups) for (const element of members.get(group.id)!) {
      const css = frame[group.id];
      for (const name of written.get(element) ?? []) if (!Object.prototype.hasOwnProperty.call(css, name)) keeper.restore(element, name);
      for (const [name, value] of Object.entries(css)) keeper.write(element, name, value, 'important');
      written.set(element, new Set(Object.keys(css)));
    }
  }
  function cancel(): void { if (handle !== undefined) { clock.cancelFrame(handle); handle = undefined; } }
  function advance(): void {
    const now = clock.now();
    if (!Number.isFinite(now)) throw new Error('L’horloge de lecture est invalide.');
    time += Math.max(0, now - started) * speed; started = now;
    if (time >= duration) {
      if (loop) time %= duration;
      else { time = duration; playing = false; cancel(); }
    }
  }
  function tick(): void {
    handle = undefined;
    if (!playing || destroyed) return;
    try { advance(); draw(); }
    catch (error) { playing = false; keeper.restoreAll(); held.clear(); written.clear(); throw error; }
    if (playing) handle = clock.requestFrame(tick);
  }
  const player: IHtmlPlaybackPlayer = {
    get currentFrame() { return integerFrame(); },
    get playing() { return playing; },
    get speed() { return speed; },
    get loop() { return loop; },
    set loop(value: boolean) { assertAlive(); if (typeof value !== 'boolean') throw new Error('La boucle doit être booléenne.'); loop = value; },
    play() {
      assertAlive(); if (playing) return;
      if (time >= duration) time = 0;
      draw(); started = clock.now(); playing = true; handle = clock.requestFrame(tick);
    },
    pause() { assertAlive(); if (playing) { advance(); playing = false; cancel(); draw(); } },
    seek(frame: number) {
      assertAlive(); if (!Number.isFinite(frame)) throw new Error('L’image doit être un nombre fini.');
      const previous = time;
      time = (Math.max(1, Math.min(data.source.totalFrames, Math.floor(frame))) - 1) * 1000 / data.source.fps;
      try { draw(); } catch (error) { time = previous; throw error; }
      if (playing) started = clock.now();
    },
    setSpeed(value: number) {
      assertAlive(); if (!Number.isFinite(value) || value <= 0) throw new Error('La vitesse de lecture doit être positive.');
      if (playing) { advance(); draw(); }
      speed = value;
    },
    destroy() { if (destroyed) return; destroyed = true; playing = false; cancel(); keeper.restoreAll(); held.clear(); written.clear(); members.clear(); }
  };
  try {
    const probe = document?.createElement('div').style;
    if (probe === undefined) throw new Error('Le document HTML est incompatible.');
    const checked = new Set<string>();
    for (const frame of Object.values(data.frames)) for (const css of Object.values(frame)) for (const [name, value] of Object.entries(css)) {
      const key = JSON.stringify([name, value]); if (checked.has(key)) continue;
      probe.cssText = ''; probe.setProperty(name, value, 'important');
      if (probe.getPropertyValue(name) === '') throw new Error(`La propriété « ${name} » n’est pas prise en charge par ce navigateur.`);
      checked.add(key);
    }
    draw(); if (options.autoplay) player.play();
  }
  catch (error) { player.destroy(); throw error; }
  return player;
}
