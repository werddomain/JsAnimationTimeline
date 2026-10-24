// dotnet/JsTimeline.Blazor/Player/TimelinePlayerState.cs
namespace JsTimeline.Blazor.Player;

/// <summary>State of a <see cref="TimelinePlayer"/>, read from the JavaScript player.</summary>
/// <param name="Frame">Current frame, 1..TotalFrames.</param>
/// <param name="Playing">Playback is running.</param>
/// <param name="TotalFrames">Length of the timeline in frames.</param>
/// <param name="Fps">Frames per second.</param>
/// <param name="Duration">Length in milliseconds.</param>
/// <param name="MissingTargets">Ids of the layers whose selector matches no element under the player.</param>
public sealed record TimelinePlayerState(
    int Frame,
    bool Playing,
    int TotalFrames,
    double Fps,
    double Duration,
    IReadOnlyList<string> MissingTargets);
