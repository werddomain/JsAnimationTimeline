/* 
PluginManager Each new functionality should be added as a plugin. 
Then the plugin is loaded from a list of classes in the dom. so we can manage the timeline more easily.
We will look at an array in the window.JsTimelinePlugins which will contain all the plugin classes to be loaded.
The PluginManager is responsible for loading, initializing, and managing the lifecycle of these plugins.
*/