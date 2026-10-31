// packages/export-css/src/continuous/htmlCascade.ts
import { HtmlCssSceneError } from './htmlErrors';

interface IApplicableRule { readonly selector: string; readonly style: CSSStyleDeclaration }
export interface ICssCascadeRules { readonly rules: readonly IApplicableRule[]; readonly keyframeNames: readonly string[]; checks: number }

/** Inaccessible sheets cannot establish that CSS animations will win the source cascade. */
export function collectCssRules(document: Document): ICssCascadeRules {
  const result: IApplicableRule[] = [];
  const visited = new Set<CSSStyleSheet>();
  const keyframeNames = new Set<string>();
  let visitedRules = 0;
  function rules(items: CSSRuleList): void {
    for (const rule of Array.from(items)) {
      if (++visitedRules > 50_000) throw new HtmlCssSceneError('resource-limit', 'La feuille source dépasse le budget d’inspection CSS.');
      if (rule.type === 7) keyframeNames.add((rule as CSSKeyframesRule).name);
      if ('selectorText' in rule && 'style' in rule) result.push({ selector: (rule as CSSStyleRule).selectorText, style: (rule as CSSStyleRule).style });
      if ('styleSheet' in rule) {
        const imported = (rule as CSSImportRule).styleSheet;
        if (imported !== null) sheet(imported);
      }
      if ('cssRules' in rule) rules((rule as CSSGroupingRule).cssRules);
    }
  }
  function sheet(source: CSSStyleSheet): void {
    if (visited.has(source) || source.disabled) return;
    visited.add(source);
    try { rules(source.cssRules); }
    catch (error) {
      if (error instanceof HtmlCssSceneError) throw error;
      throw new HtmlCssSceneError('unreadable-stylesheet', 'Une feuille de style ne peut pas être inspectée. Utilisez JavaScript/JSON ou une feuille source accessible.');
    }
  }
  [...Array.from(document.styleSheets), ...Array.from(document.adoptedStyleSheets ?? [])].forEach(sheet);
  return { rules: result, keyframeNames: [...keyframeNames], checks: 0 };
}

function isAffected(name: string, properties: readonly string[]): boolean {
  if (name === 'all') return true;
  if (properties.includes(name)) return true;
  // Logical/physical shorthands can overlap depending on writing mode; refuse conservatively.
  if (['border', 'margin', 'padding', 'inset', 'background', 'font'].some((family) =>
    (name === family || name.startsWith(`${family}-`)) && properties.some((property) => property === family || property.startsWith(`${family}-`)))) return true;
  const families: Readonly<Record<string, readonly string[]>> = {
    background: ['background-'], border: ['border-'], margin: ['margin-'], padding: ['padding-'],
    inset: ['top', 'left', 'right', 'bottom'], font: ['font-', 'line-height'], flex: ['flex-'],
    'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
    'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
    'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
    overflow: ['overflow-'], gap: ['row-gap', 'column-gap']
  };
  return (families[name] ?? []).some((prefix) => properties.some((property) => property === prefix || prefix.endsWith('-') && property.startsWith(prefix)));
}
function checkStyle(style: CSSStyleDeclaration, properties: readonly string[]): void {
  for (let index = 0; index < style.length; index++) {
    const property = style[index];
    if (style.getPropertyPriority(property) === 'important' && (isAffected(property, properties) || property.startsWith('animation'))) {
      throw new HtmlCssSceneError('important-cascade', `La déclaration !important « ${property} » empêcherait la fidélité de l’animation CSS. Utilisez JavaScript/JSON ou adaptez explicitement la feuille source.`);
    }
    if (property === 'animation' || property.startsWith('animation-') || property === 'all') {
      throw new HtmlCssSceneError('existing-animation', `La déclaration source « ${property} » peut remplacer les paramètres de l’animation CSS exportée. Retirez-la explicitement ou utilisez JavaScript/JSON.`);
    }
  }
}
function hasDuration(text: string): boolean { return text.split(',').some((part) => Number.parseFloat(part) > 0); }

export function assertCssCascade(element: Element, properties: readonly string[], source: ICssCascadeRules): void {
  if (properties.length === 0) return;
  const style = (element as HTMLElement | SVGElement).style;
  checkStyle(style, properties);
  for (const rule of source.rules) {
    if (++source.checks > 1_000_000) throw new HtmlCssSceneError('resource-limit', 'Le croisement des règles et cibles dépasse le budget CSS.');
    let matches: boolean;
    try { matches = element.matches(rule.selector); }
    catch { throw new HtmlCssSceneError('unsupported-css-rule', 'Une règle CSS source ne peut pas être inspectée avec certitude.'); }
    if (matches) checkStyle(rule.style, properties);
  }
  const view = element.ownerDocument.defaultView;
  if (view === null) throw new HtmlCssSceneError('unsupported-document', 'Le document ne possède pas de contexte CSS navigateur.');
  const computed = view.getComputedStyle(element);
  if (computed.animationName.split(',').some((name) => name.trim() !== '' && name.trim() !== 'none')) {
    throw new HtmlCssSceneError('existing-animation', 'Une animation CSS source est déjà définie sur la cible.');
  }
  if (hasDuration(computed.transitionDuration) && computed.transitionProperty.split(',').some((name) => name.trim() === 'all' || isAffected(name.trim(), properties))) {
    throw new HtmlCssSceneError('existing-transition', 'Une transition CSS source pourrait modifier le rendu exporté.');
  }
}
