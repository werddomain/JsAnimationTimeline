import { PluginManager } from './PluginManager';
import { LayerManager } from '../plugins/layers/LayerManager';
import { KeyframeManager } from '../plugins/keyframes/KeyframeManager';
import { MainToolbar } from '../plugins/toolbar/MainToolbar';
import { ObjectToolbar } from '../plugins/toolbar/ObjectToolbar';
import { TimeRuler } from '../plugins/time/TimeRuler';
import { GroupManager } from '../plugins/layers/GroupManager';

export interface Components {
    // Component instances
    LayerManager: LayerManager;
    KeyframeManager: KeyframeManager;
    MainToolbar: MainToolbar;
    ObjectToolbar: ObjectToolbar;
    TimeRuler: TimeRuler;
    GroupManager: GroupManager;
    // Plugin manager
    PluginManager: PluginManager;
}