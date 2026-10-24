// dotnet/JsTimeline.Blazor/Player/TimelineStageException.cs
namespace JsTimeline.Blazor.Player;

/// <summary>
/// The stage of a <see cref="TimelinePlayer"/> (or a player listener) threw while playing; playback goes
/// on. Only the message crosses from JavaScript.
/// </summary>
public sealed class TimelineStageException : Exception
{
    /// <summary>Creates the exception with the message of the JavaScript error.</summary>
    public TimelineStageException(string message)
        : base(message)
    {
    }
}
