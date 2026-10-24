// packages/runtime/src/stage/html/__tests__/inlineStyles.browser.test.ts
/**
 * Branche « navigateur » de la restauration des styles en ligne : `item()`
 * liste les sous-propriétés d'un raccourci et `removeProperty` les efface.
 * jsdom n'étend pas les raccourcis, donc un faux `CSSStyleDeclaration` qui
 * se comporte comme Chromium (`margin`, `border-radius`) sert d'élément.
 */

import { InlineStyleKeeper } from '../inlineStyles';

const SHORTHANDS: Readonly<Record<string, readonly string[]>> = {
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'border-radius': [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ],
};

interface IDeclaration {
  value: string;
  priority: string;
}

/** Ordered inline declarations; a shorthand is stored as its longhands, like Chromium. */
class FakeStyle {
  private declarations = new Map<string, IDeclaration>();

  get length(): number {
    return this.declarations.size;
  }

  item(index: number): string {
    return Array.from(this.declarations.keys())[index] ?? '';
  }

  getPropertyValue(name: string): string {
    const longhands = SHORTHANDS[name];
    if (longhands === undefined) {
      return this.declarations.get(name)?.value ?? '';
    }
    const parts = longhands.map((key) => this.declarations.get(key));
    if (parts.some((part) => part === undefined)) {
      return '';
    }
    const priorities = new Set(parts.map((part) => part?.priority));
    if (priorities.size > 1) {
      return '';
    }
    const values = parts.map((part) => part?.value ?? '');
    return values.every((value) => value === values[0]) ? values[0] : values.join(' ');
  }

  getPropertyPriority(name: string): string {
    const longhands = SHORTHANDS[name];
    if (longhands === undefined) {
      return this.declarations.get(name)?.priority ?? '';
    }
    const all = longhands.every((key) => this.declarations.get(key)?.priority === 'important');
    return all ? 'important' : '';
  }

  setProperty(name: string, value: string, priority = ''): void {
    if (value === '') {
      this.removeProperty(name);
      return;
    }
    const longhands = SHORTHANDS[name];
    const targets = longhands ?? [name];
    const parts = value.split(/\s+/);
    targets.forEach((key, index) => {
      const part = parts.length === targets.length ? parts[index] : parts[0];
      this.declarations.set(key, { value: part, priority });
    });
  }

  removeProperty(name: string): string {
    const previous = this.getPropertyValue(name);
    (SHORTHANDS[name] ?? [name]).forEach((key) => this.declarations.delete(key));
    return previous;
  }

  get cssText(): string {
    return Array.from(this.declarations)
      .map(([name, { value, priority }]) => `${name}: ${value}${priority === '' ? '' : ` !${priority}`};`)
      .join(' ');
  }

  set cssText(text: string) {
    this.declarations = new Map();
    text
      .split(';')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk !== '')
      .forEach((chunk) => {
        const [name, ...rest] = chunk.split(':');
        const raw = rest.join(':').trim();
        const important = /\s*!important$/.test(raw);
        this.setProperty(name.trim(), raw.replace(/\s*!important$/, ''), important ? 'important' : '');
      });
  }
}

interface IFakeDocument {
  createElement(tag: string): { style: FakeStyle };
}

function fakeElement(css: string): { target: Element; style: FakeStyle } {
  const style = new FakeStyle();
  style.cssText = css;
  const ownerDocument: IFakeDocument = { createElement: () => ({ style: new FakeStyle() }) };
  const target = {
    style,
    ownerDocument,
    hasAttribute: () => true,
    getAttribute: () => style.cssText,
    removeAttribute: () => undefined,
  };
  return { target: target as unknown as Element, style };
}

function held(target: Element): InlineStyleKeeper {
  const keeper = new InlineStyleKeeper();
  keeper.acquire(target);
  return keeper;
}

describe('InlineStyleKeeper restore in a browser (longhands listed)', () => {
  it('gives back page longhands and priority after the stage wrote border-radius', () => {
    const { target, style } = fakeElement('border-top-left-radius: 4px; border-top-right-radius: 2px !important');
    const before = style.cssText;
    const keeper = held(target);
    keeper.write(target, 'border-radius', '9px');
    keeper.write(target, 'border-radius', '12px');
    expect(style.getPropertyValue('border-radius')).toBe('12px');
    keeper.release(target);
    expect(style.getPropertyValue('border-top-left-radius')).toBe('4px');
    expect(style.getPropertyPriority('border-top-left-radius')).toBe('');
    expect(style.getPropertyValue('border-top-right-radius')).toBe('2px');
    expect(style.getPropertyPriority('border-top-right-radius')).toBe('important');
    expect(style.getPropertyValue('border-bottom-right-radius')).toBe('');
    expect(style.getPropertyValue('border-bottom-left-radius')).toBe('');
    expect(style.length).toBe(2);
    expect(style.cssText).toBe(before);
  });

  it('keeps mixed !important margin longhands', () => {
    const { target, style } = fakeElement('margin-top: 1px !important; margin-left: 2px; color: red');
    const keeper = held(target);
    keeper.write(target, 'margin', '5px');
    keeper.write(target, 'margin', '6px');
    keeper.release(target);
    expect(style.getPropertyValue('margin-top')).toBe('1px');
    expect(style.getPropertyPriority('margin-top')).toBe('important');
    expect(style.getPropertyValue('margin-left')).toBe('2px');
    expect(style.getPropertyPriority('margin-left')).toBe('');
    expect(style.getPropertyValue('margin-right')).toBe('');
    expect(style.getPropertyValue('margin-bottom')).toBe('');
    expect(style.getPropertyValue('color')).toBe('red');
  });

  it('restores everything after margin-top is written, then margin, then margin is restored', () => {
    const { target, style } = fakeElement('margin-top: 1px !important; margin-left: 2px; color: red');
    const keeper = held(target);
    keeper.write(target, 'margin-top', '9px');
    keeper.write(target, 'margin', '5px');
    keeper.restore(target, 'margin');
    keeper.release(target);
    expect(style.getPropertyValue('margin-top')).toBe('1px');
    expect(style.getPropertyPriority('margin-top')).toBe('important');
    expect(style.getPropertyValue('margin-left')).toBe('2px');
    expect(style.getPropertyValue('margin-right')).toBe('');
    expect(style.getPropertyValue('margin-bottom')).toBe('');
    expect(style.getPropertyValue('color')).toBe('red');
    expect(style.length).toBe(3);
  });
});
