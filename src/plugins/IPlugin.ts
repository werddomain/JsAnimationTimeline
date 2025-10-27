import { IJsTimeLineContext } from '../IJsTimeLineContext';

export interface IPlugin {
  name: string;
  version: string;
  initialize(context: IJsTimeLineContext): void;
  destroy?(): void;
}
