// dotnet/JsTimeline.Blazor/Stage/TimelineStageModels.cs
using JsTimeline.Blazor.Model;

namespace JsTimeline.Blazor.Stage;

/// <summary>An object a C# stage offers to the layers, under the ref <see cref="Ref"/>.</summary>
/// <param name="Ref">Ref used by the layers: <c>{ "ref": Ref, "stage": stage id }</c>. Unique in the stage.</param>
/// <param name="Label">Name shown in the target picker.</param>
/// <param name="Icon">Icon name, CSS class or URL, interpreted by the editor.</param>
/// <param name="Group">Group in the target picker.</param>
/// <param name="Properties">Names of the properties shown for this object; all the stage's when null.</param>
public sealed record TimelineStageTarget(
    string Ref,
    string Label,
    string? Icon = null,
    string? Group = null,
    IReadOnlyList<string>? Properties = null);

/// <summary>Interpolation of a property between two keyframes, picked by name in the runtime.</summary>
public enum TimelineInterpolation
{
    /// <summary>Straight line between the two values.</summary>
    Linear,
    /// <summary>Holds the first value until the next keyframe.</summary>
    Step,
    /// <summary>Linear value rounded down to an integer (an image index, for example).</summary>
    Floor,
    /// <summary>Linear value rounded to the nearest integer.</summary>
    Round,
}

/// <summary>A numeric property read by a C# stage (a <c>value</c> property: no CSS name).</summary>
/// <param name="Name">Track name in the document: a letter then letters or digits.</param>
/// <param name="DefaultValue">Value when no keyframe defines the property.</param>
/// <param name="Interpolation">How values are computed between two keyframes.</param>
/// <param name="Label">Display name in the editor.</param>
/// <param name="Group">Display group in the editor.</param>
/// <param name="Unit">Unit shown in the editor only.</param>
/// <param name="Min">Lower bound of the computed values.</param>
/// <param name="Max">Upper bound of the computed values.</param>
public sealed record TimelineStageProperty(
    string Name,
    double DefaultValue = 0,
    TimelineInterpolation Interpolation = TimelineInterpolation.Linear,
    string? Label = null,
    string? Group = null,
    string Unit = "",
    double? Min = null,
    double? Max = null);

/// <summary>State of one layer at the rendered time.</summary>
/// <param name="LayerId">Id of the layer.</param>
/// <param name="Target">Target of the layer (a ref of this stage).</param>
/// <param name="Values">Value of every property animated in the layer, completed with the defaults.</param>
/// <param name="Active">False in a blank span and outside every span.</param>
/// <param name="Visible">Eye of the layer in the editor; always true in the player.</param>
public sealed record TimelineStageLayerState(
    string LayerId,
    LayerTarget Target,
    IReadOnlyDictionary<string, double> Values,
    bool Active,
    bool Visible = true);

/// <summary>One rendered frame: the time and the state of every layer of the stage.</summary>
/// <param name="TimeMs">Milliseconds from the start.</param>
/// <param name="Frame">Fractional frame, from 1 to TotalFrames + 1.</param>
/// <param name="IntegerFrame">Displayed frame, 1..TotalFrames.</param>
/// <param name="Layers">Layers of the stage, in document order.</param>
/// <param name="Released">
/// Layers removed or retargeted since the previous frame sent: their objects are no longer animated.
/// </param>
public sealed record TimelineStageFrame(
    double TimeMs,
    double Frame,
    int IntegerFrame,
    IReadOnlyList<TimelineStageLayerState> Layers,
    IReadOnlyList<string> Released);

/// <summary>When the frames of a C# stage are sent to .NET.</summary>
public enum FrameCallbackMode
{
    /// <summary>Never: the stage only offers its targets and properties.</summary>
    Off,
    /// <summary>When the displayed frame changes, and after a new document or a time jump (the default).</summary>
    IntegerFrames,
    /// <summary>On every rendered frame (about 60 per second while playing).</summary>
    EveryTick,
}
