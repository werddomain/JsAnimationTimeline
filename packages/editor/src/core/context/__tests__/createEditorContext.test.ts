// packages/editor/src/core/context/__tests__/createEditorContext.test.ts
/**
 * Tests des façades du contexte des plugins : délégation au bus, au Store et
 * à la pile, objets figés sans référence vers les pièces brutes, garde
 * après destruction, et (tests de typage `@ts-expect-error`) impossibilité
 * d'atteindre `load`, `createCommandStack` ou `clear` par le contexte.
 */

import type { ITimelineDocument } from '@werddomain/timeline-runtime';
import { createDocument, renameLayer } from '../../commands/__tests__/fixtures';
import { EventBus } from '../../events/EventBus';
import { SlotRegistry } from '../../plugin/SlotRegistry';
import { Store } from '../../store/Store';
import { catchError, createCounter } from '../../editor/__tests__/fixtures';
import { createEditorContext } from '../createEditorContext';
import type { IEditorContext } from '../IEditorContext';
import { ServiceRegistry } from '../ServiceRegistry';

interface IContextHarness {
  readonly ctx: IEditorContext;
  readonly bus: EventBus;
  readonly store: Store;
  readonly services: ServiceRegistry;
  readonly kill: () => void;
}

function createHarness(): IContextHarness {
  const bus = new EventBus();
  const store = new Store(bus, createDocument());
  const commands = store.createCommandStack();
  const services = new ServiceRegistry();
  const container = document.createElement('div');
  let alive = true;
  const assertActive = (operation: string): void => {
    if (!alive) throw new Error(`détruit : ${operation}`);
  };
  const ctx = createEditorContext({
    bus, store, commands, services, container, assertActive,
    slots: new SlotRegistry(),
    root: document
  });
  return { ctx, bus, store, services, kill: () => (alive = false) };
}

describe('createEditorContext facades', () => {
  it('reads the current document from the store on every access', () => {
    // Arrange
    const { ctx } = createHarness();
    const before = ctx.document;

    // Act
    ctx.commands.execute(renameLayer('l1', 'Titre', 'Logo'));

    // Assert
    expect(ctx.document).not.toBe(before);
    expect(ctx.document.layers[0]?.name).toBe('Titre');
  });

  it('delegates every events method to the bus', () => {
    // Arrange
    const { ctx, bus } = createHarness();
    const seen: string[] = [];
    const handler = (): void => void seen.push('on');
    ctx.events.on('editor:destroying', handler);
    ctx.events.once('editor:destroying', () => seen.push('once'));
    ctx.events.onCancellable('editor:destroying', (event) => event.cancel());

    // Act
    ctx.events.emit('editor:destroying', {});
    ctx.events.off('editor:destroying', handler);
    bus.emit('editor:destroying', {});
    const allowed = ctx.events.emitCancellable('editor:destroying', {});

    // Assert
    expect(seen).toEqual(['on', 'once']);
    expect(allowed).toBe(false);
  });

  it('exposes the history state and grouping through ctx.commands', () => {
    // Arrange
    const { ctx } = createHarness();

    // Act
    ctx.commands.beginGroup('Glisser');
    const grouping = ctx.commands.isGrouping;
    ctx.commands.execute(renameLayer('l1', 'A', 'Logo'));
    ctx.commands.endGroup();
    const afterGroup = { canUndo: ctx.commands.canUndo, label: ctx.commands.undoLabel };
    ctx.commands.undo();

    // Assert
    expect(grouping).toBe(true);
    expect(afterGroup).toEqual({ canUndo: true, label: 'Glisser' });
    expect(ctx.commands.canRedo).toBe(true);
    expect(ctx.commands.redoLabel).toBe('Glisser');
    expect(ctx.commands.redo()).toBe(true);
    ctx.commands.beginGroup('Annulé');
    ctx.commands.execute(renameLayer('l1', 'B', 'A'));
    ctx.commands.cancelGroup();
    expect(ctx.document.layers[0]?.name).toBe('A');
  });

  it('delegates services to the registry', () => {
    // Arrange
    const { ctx, services } = createHarness();
    const counter = createCounter();

    // Act
    ctx.services.provide('test.counter', counter);

    // Assert
    expect(services.get('test.counter')).toBe(counter);
    expect(ctx.services.get('test.counter')).toBe(counter);
    expect(ctx.services.require('test.counter')).toBe(counter);
  });

  it('freezes every facade and holds no raw core object', () => {
    // Arrange
    const { ctx, bus, store, services } = createHarness();
    const values: unknown[] = [
      ...Object.values(ctx),
      ...Object.values(ctx.events),
      ...Object.values(ctx.commands),
      ...Object.values(ctx.services)
    ];

    // Assert
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.events)).toBe(true);
    expect(Object.isFrozen(ctx.commands)).toBe(true);
    expect(Object.isFrozen(ctx.services)).toBe(true);
    expect(values).not.toContain(bus);
    expect(values).not.toContain(store);
    expect(values).not.toContain(services);
    expect('clear' in ctx.events).toBe(false);
    expect('clear' in ctx.commands).toBe(false);
    expect('load' in ctx.commands).toBe(false);
    expect('clear' in ctx.services).toBe(false);
    expect(Object.keys(ctx).sort()).toEqual([
      'commands', 'container', 'document', 'events', 'root', 'services', 'slots'
    ]);
  });

  it('refuses actions once the editor is destroyed but keeps reads and off', () => {
    // Arrange
    const { ctx, kill } = createHarness();
    const handler = (): void => undefined;
    ctx.events.on('editor:ready', handler);
    kill();

    // Act
    const errors = [
      catchError(() => ctx.events.on('editor:ready', handler)),
      catchError(() => ctx.events.once('editor:ready', handler)),
      catchError(() => ctx.events.emit('editor:ready', { pluginIds: [] })),
      catchError(() => ctx.events.onCancellable('editor:ready', handler)),
      catchError(() => ctx.events.emitCancellable('editor:ready', { pluginIds: [] })),
      catchError(() => ctx.commands.execute(renameLayer('l1', 'A', 'Logo'))),
      catchError(() => ctx.commands.undo()),
      catchError(() => ctx.commands.redo()),
      catchError(() => ctx.commands.beginGroup('G')),
      catchError(() => ctx.commands.endGroup()),
      catchError(() => ctx.commands.cancelGroup()),
      catchError(() => ctx.services.provide('test.counter', createCounter()))
    ];

    // Assert
    expect(errors.map((error) => (error as Error).message)).toEqual([
      'détruit : events.on', 'détruit : events.once', 'détruit : events.emit',
      'détruit : events.onCancellable', 'détruit : events.emitCancellable',
      'détruit : commands.execute', 'détruit : commands.undo', 'détruit : commands.redo',
      'détruit : commands.beginGroup', 'détruit : commands.endGroup', 'détruit : commands.cancelGroup',
      'détruit : services.provide'
    ]);
    expect(() => ctx.events.off('editor:ready', handler)).not.toThrow();
    expect(ctx.document.layers).toHaveLength(2);
    expect(ctx.commands.canUndo).toBe(false);
    expect(ctx.services.get('test.counter')).toBeUndefined();
  });

  it('keeps the raw store, the stack factory and bus.clear out of reach (types)', () => {
    // Arrange
    const { ctx } = createHarness();
    const doc: ITimelineDocument = createDocument();

    // Act
    const reach = (): unknown[] => [
      // @ts-expect-error le contexte n'expose pas le Store brut
      ctx.store,
      // @ts-expect-error le contexte n'expose pas Store.load
      ctx.load(doc),
      // @ts-expect-error l'historique n'expose pas load
      ctx.commands.load(doc),
      // @ts-expect-error l'historique n'expose pas createCommandStack
      ctx.commands.createCommandStack(),
      // @ts-expect-error l'historique n'expose pas clear
      ctx.commands.clear(),
      // @ts-expect-error les événements n'exposent pas clear
      ctx.events.clear(),
      // @ts-expect-error les événements n'exposent pas listenerCount
      ctx.events.listenerCount(),
      // @ts-expect-error les services n'exposent pas clear
      ctx.services.clear()
    ];
    const assign = (): void => {
      // @ts-expect-error le document est en lecture seule
      ctx.document = doc;
    };

    // Assert
    expect(typeof reach).toBe('function');
    expect(typeof assign).toBe('function');
  });
});
