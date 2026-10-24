// packages/editor/src/plugins/layers/target/__tests__/TargetPlugin.test.ts
/**
 * `layers.target` dans un vrai éditeur (fausse scène avec `list`, `describe`
 * et `pick`) : bouton de cible sur les calques seulement, après le cadenas ;
 * service `setTarget` (une entrée d'historique, aucune sans changement, jamais
 * d'exception) ; alerte de cible manquante (raison, mise à jour après
 * `refreshTargets`, rien avec `stage: false`) ; icône du calque inchangée ;
 * et nettoyage à la destruction.
 */

import { createCommand } from '../../../../core/commands/createCommand';
import { LAYER_COLOR_CONTROL_ORDER } from '../../color/layerColorControl';
import { LOCK_CONTROL_ORDER } from '../../lock/LockPlugin';
import { TargetAlertLabels } from '../targetAlert';
import { TARGET_CONTROL_ORDER } from '../TargetPlugin';
import { mountTarget, targetButton, unmountTargets } from './fixtures';

afterEach(unmountTargets);

describe('layers.target row control', () => {
  it('renders a target button on layers only, after the lock and the color square', () => {
    // Arrange
    const { host } = mountTarget();

    // Act
    const heroControls = Array.from(host.querySelectorAll('[data-row-id="hero"] .jt-layer-row__controls > *'));
    const targetIndex = heroControls.findIndex((element) => element.querySelector('.jt-layer-target') !== null);
    const lockIndex = heroControls.findIndex((element) => element.querySelector('.jt-layer-flag--lock') !== null);

    // Assert
    expect(TARGET_CONTROL_ORDER).toBeGreaterThan(LOCK_CONTROL_ORDER);
    expect(TARGET_CONTROL_ORDER).toBeGreaterThan(LAYER_COLOR_CONTROL_ORDER);
    expect(targetIndex).toBeGreaterThan(lockIndex);
    expect(targetButton(host, 'hero').getAttribute('aria-label')).toBe('Cible de « Héros » : Objet hero');
    expect(targetButton(host, 'bare').getAttribute('aria-label')).toBe('Cible de « Nu » : aucune cible');
    expect(host.querySelector('[data-row-id="f"] .jt-layer-target')).toBeNull();
  });
});

describe('layers.target service', () => {
  it('changes the target with one undo step, and does nothing for the same target', () => {
    // Arrange
    const { editor, service } = mountTarget();

    // Act
    const changed = service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    const same = service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    editor.undo();

    // Assert
    expect(changed).toBe(true);
    expect(same).toBe(false);
    expect(editor.canUndo).toBe(false);
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'canvas' } });
  });

  it('returns false without throwing for a folder, an unknown layer or a live element', () => {
    // Arrange
    const { editor, service } = mountTarget();

    // Assert
    expect(service.setTarget('f', { selector: '#a' })).toBe(false);
    expect(service.setTarget('nope', { selector: '#a' })).toBe(false);
    expect(service.setTarget('hero', { element: document.createElement('div') })).toBe(false);
    expect(editor.canUndo).toBe(false);
  });

  it('accepts an invalid selector: the layer becomes a missing target with its reason', () => {
    // Arrange
    const { editor, host, service } = mountTarget();

    // Act
    const changed = service.setTarget('hero', { selector: 'div[' });

    // Assert
    expect(changed).toBe(true);
    expect(editor.stage.missingTargets).toContain('hero');
    expect(service.alert('hero').label).toBe(TargetAlertLabels.unrouted);
    expect(targetButton(host, 'hero').classList.contains('jt-layer-target--missing')).toBe(true);
  });
});

describe('layers.target missing-target alert', () => {
  it('updates after refreshTargets finds the object', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.setTarget('hero', { ref: 'moon', stage: 'canvas' });
    const before = targetButton(host, 'hero').classList.contains('jt-layer-target--missing');

    // Act
    const stage = editor.stage.stages[0] as unknown as { objects: Set<string> };
    stage.objects.add('moon');
    editor.refreshTargets();

    // Assert
    expect(before).toBe(true);
    expect(service.alert('hero').missing).toBe(false);
    expect(targetButton(host, 'hero').classList.contains('jt-layer-target--missing')).toBe(false);
  });

  it('names an unknown stage', () => {
    // Arrange
    const { host, service } = mountTarget();

    // Act
    service.setTarget('hero', { ref: 'hero', stage: 'audio' });

    // Assert
    expect(service.alert('hero').label).toBe(TargetAlertLabels.unknownStage('audio'));
    expect(targetButton(host, 'hero').title).toContain(TargetAlertLabels.unknownStage('audio'));
  });

  it('shows no alert in timeline-only mode', () => {
    // Arrange
    const { host, service } = mountTarget({ stage: false });

    // Act
    service.setTarget('hero', { selector: '#nowhere' });

    // Assert
    expect(service.alert('hero').missing).toBe(false);
    expect(targetButton(host, 'hero').classList.contains('jt-layer-target--missing')).toBe(false);
  });

  it('never changes the layer icon', () => {
    // Arrange
    const { host, service } = mountTarget();
    const icon = (): string => host.querySelector('[data-row-id="hero"] .jt-layer-row__icon')?.outerHTML ?? '';
    const before = icon();

    // Act
    service.setTarget('hero', { selector: '#somewhere' });

    // Assert
    expect(icon()).toBe(before);
  });
});

describe('layers.target cleanup', () => {
  it('closes the popup when its layer is removed', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.open('hero');
    const removeHero = createCommand(
      'Supprimer',
      (doc) => ({ ...doc, layers: doc.layers.filter((node) => node.id !== 'hero') }),
      (doc) => doc
    );

    // Act
    editor.execute(removeHero);

    // Assert
    expect(host.querySelector('.jt-target-popup')).toBeNull();
  });

  it('removes its controls, popup and service on destroy', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.open('hero');

    // Act
    editor.destroy();

    // Assert
    expect(host.querySelector('.jt-layer-target')).toBeNull();
    expect(host.querySelector('.jt-target-popup')).toBeNull();
    expect(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))).not.toThrow();
  });
});

describe('layers.target row button keys', () => {
  it('lets Ctrl+Z reach the editor from the row button, and toggles the popup', () => {
    // Arrange
    const { editor, host, service } = mountTarget();
    service.setTarget('hero', { ref: 'sun', stage: 'canvas' });
    const button = targetButton(host, 'hero');

    // Act
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    button.click();
    const expanded = button.getAttribute('aria-expanded');
    button.click();

    // Assert
    expect(editor.document.layers[0]).toMatchObject({ target: { ref: 'hero', stage: 'canvas' } });
    expect(expanded).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.jt-target-popup')).toBeNull();
  });
});
