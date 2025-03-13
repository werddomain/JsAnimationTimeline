@echo off
echo Creating js-timeline-control project structure...

:: Create main directory and subdirectories
mkdir js-timeline-control
cd js-timeline-control

:: Create src directory and its subdirectories
mkdir src
mkdir src\core
mkdir src\plugins
mkdir src\plugins\keyframes
mkdir src\plugins\layers
mkdir src\plugins\panel
mkdir src\plugins\time
mkdir src\plugins\toolbar
mkdir src\utils

:: Create core files
echo. > src\core\BaseComponent.ts
echo. > src\core\Constants.ts
echo. > src\core\DataModel.ts
echo. > src\core\EventEmitter.ts
echo. > src\core\EventTypes.ts
echo. > src\core\PluginManager.ts
echo. > src\core\TimelineControl.ts

:: Create plugins files
:: keyframes
echo. > src\plugins\keyframes\KeyframeEditor.ts
echo. > src\plugins\keyframes\KeyframeManager.ts
echo. > src\plugins\keyframes\MotionTweenEditor.ts

:: layers
echo. > src\plugins\layers\GroupManager.ts
echo. > src\plugins\layers\LayerEditor.ts
echo. > src\plugins\layers\LayerManager.ts

:: panel
echo. > src\plugins\panel\CssAnimationGenerator.ts
echo. > src\plugins\panel\MotionTweenPreview.ts
echo. > src\plugins\panel\PanelComponent.ts
echo. > src\plugins\panel\PropertyEditor.ts

:: time
echo. > src\plugins\time\PlaybackController.ts
echo. > src\plugins\time\TimeRuler.ts
echo. > src\plugins\time\TimeSeeker.ts

:: toolbar
echo. > src\plugins\toolbar\MainToolbar.ts
echo. > src\plugins\toolbar\ObjectToolbar.ts

:: utils
echo. > src\utils\DragDropUtils.ts
echo. > src\utils\ExportUtils.ts
echo. > src\utils\ImportUtils.ts
echo. > src\utils\TimeUtils.ts

:: Create main export file
echo. > src\index.ts

:: Create styles directory and its subdirectories
mkdir styles
mkdir styles\components

:: Create style files
echo. > styles\core.less
echo. > styles\timeline.less
echo. > styles\utilities.less
echo. > styles\variables.less

:: Create component style files
echo. > styles\components\keyframes.less
echo. > styles\components\layers.less
echo. > styles\components\motion-tween-preview.less
echo. > styles\components\object-toolbar.less
echo. > styles\components\panel.less
echo. > styles\components\property-editor.less
echo. > styles\components\time-ruler.less
echo. > styles\components\toolbar.less

:: Create examples directory and its subdirectories
mkdir examples
mkdir examples\assets
mkdir examples\advanced

:: Create example files
echo. > examples\assets\example-icons.svg

:: Advanced examples
echo. > examples\advanced\character-animation.html
echo. > examples\advanced\custom-plugin.html
echo. > examples\advanced\integration.html

:: Basic examples
echo. > examples\basic.html
echo. > examples\css-animation.html
echo. > examples\data-model.html
echo. > examples\events.html
echo. > examples\panel.html
echo. > examples\panel-property-editor.html

:: Create output directories
mkdir dist
mkdir types

:: Create test directory and its subdirectories
mkdir test
mkdir test\core
mkdir test\plugins

:: Create config files
echo. > .gitignore
echo. > .prettierrc
echo. > .eslintrc.js
echo. > build.js
echo. > package.json
echo. > README.md
echo. > tsconfig.json
echo. > LICENSE

echo Project structure created successfully!
cd ..
