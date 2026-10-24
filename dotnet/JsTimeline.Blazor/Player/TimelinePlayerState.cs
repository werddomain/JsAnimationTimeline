// dotnet/JsTimeline.Blazor/Player/TimelinePlayerState.cs
namespace JsTimeline.Blazor.Player;

/// <summary>State of a <see cref="TimelinePlayer"/>, read from the JavaScript player.</summary>
/// <param name="Frame">Current frame, 1..TotalFrames.</param>
/// <param name="Playing">Playback is running.</param>
/// <param name="TotalFrames">Length of the timeline in frames.</param>
/// <param name="Fps">Frames per second.</param>
/// <param name="Duration">Length in milliseconds.</param>
/// <param name="MissingTargets">
/// Ids of the layers without an animated element: no target, or a selector that matches nothing under
/// the player or is invalid. <see cref="TimelinePlayer.RefreshTargetsAsync"/> retries them.
/// </param>
/// <param name="Warnings">Warnings of the stage for the current document (reset by each new document).</param>
public sealed record TimelinePlayerState(
    int Frame,
    bool Playing,
    int TotalFrames,
    double Fps,
    double Duration,
    IReadOnlyList<string> MissingTargets,
    IReadOnlyList<TimelineStageWarning> Warnings);

/// <summary>A warning of the stage about the current document.</summary>
/// <param name="Code">
/// <c>unknown-stage</c>, <c>unrouted</c>, <c>duplicate-target</c>, <c>unknown-property</c> or <c>stage-error</c>.
/// </param>
/// <param name="Message">Readable description.</param>
/// <param name="StageId">Stage concerned, when there is one.</param>
/// <param name="LayerId">Layer concerned, when there is one.</param>
/// <param name="Property">Skipped track, for <c>unknown-property</c>.</param>
public sealed record TimelineStageWarning(string Code, string Message, string? StageId, string? LayerId, string? Property);
