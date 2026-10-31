// packages/runtime/src/playback/html/types.ts
import type { PropertyRegistry } from '../../properties/PropertyRegistry';
import type { IHtmlAnimationContext } from '../../stage/html/animationTypes';
import type { IPlayerClock } from '../../transport/types';
import type { IPlaybackDocument } from '../types';

export interface IHtmlPlaybackGroup {
  readonly id: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly count: number;
}
export type HtmlPlaybackDeclarations = Readonly<Record<string, string>>;
export type IHtmlPlaybackFrame = Readonly<Record<string, HtmlPlaybackDeclarations>>;
/** Discrete rendering authority; source retains separate, generic authored objects. */
export interface IHtmlPlaybackDocument {
  readonly version: 1;
  readonly sampling: 'frames';
  readonly source: IPlaybackDocument;
  readonly groups: readonly IHtmlPlaybackGroup[];
  readonly frames: Readonly<Record<string, IHtmlPlaybackFrame>>;
}
export interface ICompileHtmlPlaybackOptions {
  readonly root: ParentNode;
  readonly animationContext?: IHtmlAnimationContext;
  readonly registry?: PropertyRegistry;
  readonly sourceStage?: { withSourceStyles<T>(action: () => T): T };
  readonly selectorForElement?: (element: Element) => string | undefined;
  readonly maxCells?: number;
}
export interface IHtmlPlaybackPlayerOptions {
  readonly root: ParentNode;
  readonly clock?: IPlayerClock;
  readonly loop?: boolean;
  readonly speed?: number;
  readonly autoplay?: boolean;
}
export interface IHtmlPlaybackPlayer {
  readonly currentFrame: number;
  readonly playing: boolean;
  readonly speed: number;
  loop: boolean;
  play(): void;
  pause(): void;
  seek(frame: number): void;
  setSpeed(speed: number): void;
  destroy(): void;
}
