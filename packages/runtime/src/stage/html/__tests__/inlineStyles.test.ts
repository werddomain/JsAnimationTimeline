// packages/runtime/src/stage/html/__tests__/inlineStyles.test.ts
/**
 * Sauvegarde des styles en ligne du mode `frame` : un raccourci posé en
 * partie par la page (`border-radius` avec un seul coin), ou avec des
 * `!important` mêlés, revient tel quel après `release`, `restore` et
 * `restoreOriginals` ; une première écriture sans effet n'est pas retenue.
 */

import { InlineStyleKeeper } from '../inlineStyles';

function element(style: string): HTMLElement {
  document.body.innerHTML = `<div id="a" style="${style}"></div>`;
  return document.getElementById('a') as HTMLElement;
}

function held(target: Element): InlineStyleKeeper {
  const keeper = new InlineStyleKeeper();
  keeper.acquire(target);
  return keeper;
}

describe('InlineStyleKeeper and shorthands', () => {
  it('keeps a longhand the page set when the stage writes its shorthand', () => {
    const target = element('border-top-left-radius: 4px');
    const keeper = held(target);
    keeper.write(target, 'border-radius', '9px');
    keeper.write(target, 'border-radius', '12px');
    expect(target.style.getPropertyValue('border-radius')).toBe('12px');
    keeper.release(target);
    expect(target.style.getPropertyValue('border-top-left-radius')).toBe('4px');
    expect(target.style.getPropertyValue('border-top-right-radius')).toBe('');
    expect(target.style.getPropertyValue('border-radius')).toBe('');
  });

  it('gives back longhands with mixed !important after release', () => {
    const target = element('margin-top: 1px !important; margin-left: 2px; color: red');
    const keeper = held(target);
    keeper.write(target, 'margin', '5px');
    keeper.write(target, 'margin', '6px');
    keeper.release(target);
    expect(target.style.getPropertyValue('margin-top')).toBe('1px');
    expect(target.style.getPropertyPriority('margin-top')).toBe('important');
    expect(target.style.getPropertyValue('margin-left')).toBe('2px');
    expect(target.style.getPropertyPriority('margin-left')).toBe('');
    // jsdom keeps stale longhand values after removeProperty: the attribute tells what is set.
    expect(target.getAttribute('style')).not.toContain('6px');
    expect(target.getAttribute('style')).toContain('margin-top: 1px !important;');
    expect(target.style.getPropertyValue('color')).toBe('red');
  });

  it('gives back the longhands on restoreOriginals and restore, keeping the counter', () => {
    const target = element('margin-top: 1px !important; margin-left: 2px');
    const keeper = held(target);
    keeper.write(target, 'margin', '5px');
    keeper.restoreOriginals();
    expect(target.style.getPropertyPriority('margin-top')).toBe('important');
    expect(keeper.count(target)).toBe(1);
    keeper.write(target, 'margin', '7px');
    keeper.restore(target, 'margin');
    expect(target.style.getPropertyValue('margin-top')).toBe('1px');
    expect(target.style.getPropertyValue('margin-left')).toBe('2px');
    keeper.restoreAll();
    expect(keeper.count(target)).toBe(0);
  });

  it('keeps the longhands of a shorthand the page set when the stage writes one of them', () => {
    const target = element('margin: 3px');
    const keeper = held(target);
    keeper.write(target, 'margin-top', '9px');
    keeper.release(target);
    expect(target.style.getPropertyValue('margin-top')).toBe('3px');
    expect(target.style.getPropertyValue('margin-bottom')).toBe('3px');
  });

  it('saves on the first write that changes something', () => {
    const target = element('opacity: 0.5');
    const keeper = held(target);
    keeper.write(target, 'opacity', '0.5');
    target.style.setProperty('opacity', '0.25', 'important');
    keeper.write(target, 'opacity', '1');
    keeper.release(target);
    expect(target.style.getPropertyValue('opacity')).toBe('0.25');
    expect(target.style.getPropertyPriority('opacity')).toBe('important');
  });

  it('restores nothing for a name never written', () => {
    const target = element('color: red');
    const keeper = held(target);
    keeper.restore(target, 'opacity');
    keeper.restore(document.body, 'opacity');
    expect(target.style.cssText).toBe('color: red;');
  });
});
