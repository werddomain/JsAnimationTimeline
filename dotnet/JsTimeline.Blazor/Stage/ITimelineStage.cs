// dotnet/JsTimeline.Blazor/Stage/ITimelineStage.cs
namespace JsTimeline.Blazor.Stage;

/// <summary>
/// A stage written in C#: the timeline evaluates the layers in the browser and sends the values of
/// each frame to <see cref="RenderAsync"/> (for example to drive Blazor state, a device or a game).
/// One call runs at a time; frames produced during a call are dropped except the newest one.
/// <see cref="Targets"/> and <see cref="Properties"/> are read once, when the stage is plugged in.
/// </summary>
public interface ITimelineStage
{
    /// <summary>
    /// Stage id, unique among the stages of an editor or player: the layers target it with
    /// <c>{ "ref": "...", "stage": Id }</c>.
    /// </summary>
    string Id { get; }

    /// <summary>Objects the layers can animate, shown in the target picker of the editor.</summary>
    IReadOnlyList<TimelineStageTarget> Targets { get; }

    /// <summary>Numeric properties the stage reads, added to the property registry.</summary>
    IReadOnlyList<TimelineStageProperty> Properties { get; }

    /// <summary>Applies one frame. A thrown exception is reported to the timeline and the next frames still come.</summary>
    /// <param name="frame">Time of the frame and state of every layer of the stage.</param>
    /// <param name="cancellationToken">Cancelled when the stage is released.</param>
    Task RenderAsync(TimelineStageFrame frame, CancellationToken cancellationToken);
}
