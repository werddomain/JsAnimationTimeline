// packages/runtime/src/stage/html/cssCompose.ts
import type { TimelinePropertyValue } from '../../model/propertyTimeline';
import type { TimelinePropertyValues } from '../../properties/timelineValues';
import { captureHtmlTransformBase } from './cssBaseline';
import { htmlBindingDestination, htmlGradientValueKind, isHtmlPropertyBinding } from './cssBindings';
import { composeHtmlTransform } from './cssTransform';
import type { HtmlReadResult, HtmlTransformValues, IHtmlCssComposition, IHtmlCssDiagnostic,
  IHtmlGradientDefinition, IHtmlResolvedBinding } from './cssTypes';
import { htmlColorText, htmlNumberText, isHtmlColor, supportedHtmlDeclaration } from './cssValue';
import { composeHtmlGradient, validateHtmlGradientValue } from './gradients';
import type { IHtmlGradientChange } from './gradients';

interface IEntry { readonly property: string; readonly value: TimelinePropertyValue; readonly resolved: IHtmlResolvedBinding }

/** Values are validated before CSS serialization; strings are individual CSS values, never declaration blocks. */
export function validateHtmlPropertyValue(
  element: Element, resolved: IHtmlResolvedBinding, value: TimelinePropertyValue, gradients: readonly IHtmlGradientDefinition[] = []
): string | undefined {
  const { binding, valueKind } = resolved;
  if (!isHtmlPropertyBinding(binding) || value === null || typeof value !== 'object' || value.kind !== valueKind) return 'Le type ou la destination de la propriété CSS est invalide.';
  if (value.kind === 'number' && !Number.isFinite(value.value)) return 'La propriété CSS doit être un nombre fini.';
  if (value.kind === 'text' && typeof value.value !== 'string') return 'La propriété CSS doit être un texte.';
  if (value.kind === 'boolean' && typeof value.value !== 'boolean') return 'La présence d’un point doit être booléenne.';
  if (value.kind === 'color' && !isHtmlColor(value)) return 'La couleur CSS doit contenir des composantes entre 0 et 1.';
  if (binding.kind === 'gradient') {
    if (value.kind !== htmlGradientValueKind(binding.component)) return 'Le type du composant du dégradé est incompatible.';
    return validateHtmlGradientValue(binding, value, gradients);
  }
  if (binding.kind === 'transform') return value.kind === 'number' ? undefined : 'Une composante de transformation exige un nombre.';
  const css = styleValue(value, binding.unit ?? '');
  return css === undefined || !supportedHtmlDeclaration(element, binding.cssName, css)
    ? `La valeur de « ${binding.cssName} » n'est pas une déclaration CSS prise en charge.` : undefined;
}

function styleValue(value: TimelinePropertyValue, unit: string): string | undefined {
  if (value.kind === 'number') return `${htmlNumberText(value.value)}${unit}`;
  if (value.kind === 'color') return htmlColorText(value);
  if (value.kind === 'text') return value.value;
  return undefined;
}

function entriesOf(values: TimelinePropertyValues, bindings: Readonly<Record<string, IHtmlResolvedBinding>>, diagnostics: IHtmlCssDiagnostic[]): IEntry[] {
  const entries: IEntry[] = [];
  for (const [property, value] of Object.entries(values)) {
    const resolved = Object.prototype.hasOwnProperty.call(bindings, property) ? bindings[property] : undefined;
    if (resolved === undefined || !isHtmlPropertyBinding(resolved.binding)) diagnostics.push({ property, reason: 'La propriété ne possède pas de destination CSS valide.' });
    else entries.push({ property, value, resolved });
  }
  const groups = new Map<string, IEntry[]>();
  for (const entry of entries) {
    const destination = htmlBindingDestination(entry.resolved.binding);
    groups.set(destination, [...(groups.get(destination) ?? []), entry]);
  }
  const duplicate = new Set<IEntry>();
  groups.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((entry) => {
      duplicate.add(entry);
      diagnostics.push({ property: entry.property, reason: 'Plusieurs propriétés pilotent la même destination CSS ; résolvez le conflit avant le rendu.' });
    });
  });
  return entries.filter((entry) => !duplicate.has(entry));
}

function composeTransforms(element: Element, entries: readonly IEntry[], base: HtmlTransformValues | undefined): HtmlReadResult<string> {
  const captured = base === undefined ? captureHtmlTransformBase(element) : { status: 'value' as const, value: base };
  if (captured.status !== 'value') return captured;
  const values = { ...captured.value };
  for (const { resolved, value } of entries) {
    if (resolved.binding.kind === 'transform' && value.kind === 'number') values[resolved.binding.component] = value.value;
  }
  if (!Object.values(values).every(Number.isFinite)) return { status: 'unsupported', reason: 'La transformation contient une valeur non finie.' };
  return { status: 'value', value: composeHtmlTransform(values) };
}

/** Pure composition. Supply the captured transform base when composing during preview. */
export function composeHtmlDeclarations(
  element: Element, values: TimelinePropertyValues, bindings: Readonly<Record<string, IHtmlResolvedBinding>>,
  gradients: readonly IHtmlGradientDefinition[] = [], transformBase?: HtmlTransformValues
): IHtmlCssComposition {
  const declarations: Record<string, string> = {};
  const diagnostics: IHtmlCssDiagnostic[] = [];
  const entries = entriesOf(values, bindings, diagnostics);
  const invalid = new Set<IEntry>();
  entries.forEach((entry) => {
    const reason = validateHtmlPropertyValue(element, entry.resolved, entry.value, gradients);
    if (reason !== undefined) { invalid.add(entry); diagnostics.push({ property: entry.property, reason }); }
  });
  const transforms = entries.filter(({ resolved }) => resolved.binding.kind === 'transform');
  if (transforms.length > 0 && !transforms.some((entry) => invalid.has(entry))) {
    const composed = composeTransforms(element, transforms, transformBase);
    if (composed.status === 'value') declarations.transform = composed.value;
    else transforms.forEach(({ property }) => diagnostics.push({ property, reason: composed.reason }));
  }
  const gradientGroups = new Map<string, IEntry[]>();
  for (const entry of entries) {
    if (entry.resolved.binding.kind !== 'gradient') continue;
    const id = entry.resolved.binding.gradientId;
    gradientGroups.set(id, [...(gradientGroups.get(id) ?? []), entry]);
  }
  gradientGroups.forEach((group, id) => {
    if (group.some((entry) => invalid.has(entry))) return;
    if (gradientGroups.size > 1) {
      group.forEach(({ property }) => diagnostics.push({ property, reason: 'Plusieurs dégradés pilotent background-image ; une résolution explicite est nécessaire.' }));
      return;
    }
    const definition = gradients.find((gradient) => gradient.id === id);
    if (definition === undefined) return; // Already reported by value validation.
    const changes = group.map(({ resolved, value }) => ({ binding: resolved.binding, value })) as IHtmlGradientChange[];
    const composed = composeHtmlGradient(definition, changes);
    if (composed.status === 'value') declarations[definition.cssName] = composed.value;
    else group.forEach(({ property }) => diagnostics.push({ property, reason: composed.reason }));
  });
  for (const entry of entries) {
    const { binding } = entry.resolved;
    if (binding.kind !== 'style' || invalid.has(entry)) continue;
    if (Object.prototype.hasOwnProperty.call(declarations, binding.cssName)) {
      delete declarations[binding.cssName];
      diagnostics.push({ property: entry.property, reason: 'Cette déclaration CSS entre en conflit avec des composantes animées.' });
      continue;
    }
    const css = styleValue(entry.value, binding.unit ?? '');
    if (css !== undefined) declarations[binding.cssName] = css;
  }
  return { declarations, diagnostics };
}
