// dotnet/JsTimeline.Blazor/Stage/TimelineStageOption.cs
namespace JsTimeline.Blazor.Stage;

/// <summary>
/// What the timeline animates (the future <c>Stage</c> parameter of the editor component):
/// <see cref="Html"/> (the default), <see cref="JsModule"/>, <see cref="DotNet"/> or <see cref="None"/>.
/// </summary>
public abstract record TimelineStageOption
{
    private protected TimelineStageOption()
    {
    }

    /// <summary>The HTML elements of the page, through the default HTML stage.</summary>
    public static TimelineStageOption Html { get; } = new HtmlStageOption();

    /// <summary>No stage: the timeline only edits the document (frames can still be read).</summary>
    public static TimelineStageOption None { get; } = new NoStageOption();

    /// <summary>
    /// A stage written in JavaScript, for full speed (60 frames per second without .NET calls).
    /// The module exports <c>createStage()</c> returning an <c>IStage</c> of the runtime.
    /// </summary>
    /// <param name="modulePath">Path of the module, relative to the app base, e.g. <c>./js/myStage.js</c>.</param>
    public static TimelineStageOption JsModule(string modulePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(modulePath);
        return new JsModuleStageOption(modulePath);
    }

    /// <summary>A stage written in C#; see <see cref="ITimelineStage"/>.</summary>
    /// <param name="stage">The stage.</param>
    /// <param name="mode">When frames are sent to the stage.</param>
    public static TimelineStageOption DotNet(ITimelineStage stage, FrameCallbackMode mode = FrameCallbackMode.IntegerFrames)
    {
        ArgumentNullException.ThrowIfNull(stage);
        if (!Enum.IsDefined(mode))
        {
            throw new ArgumentOutOfRangeException(nameof(mode), mode, "Unknown frame callback mode.");
        }
        return new DotNetStageOption(stage, mode);
    }
}

/// <summary>The default HTML stage.</summary>
public sealed record HtmlStageOption : TimelineStageOption;

/// <summary>No stage.</summary>
public sealed record NoStageOption : TimelineStageOption;

/// <summary>A JavaScript stage module.</summary>
/// <param name="ModulePath">Path of the module, relative to the app base.</param>
public sealed record JsModuleStageOption(string ModulePath) : TimelineStageOption;

/// <summary>A C# stage.</summary>
/// <param name="Stage">The stage.</param>
/// <param name="Mode">When frames are sent to the stage.</param>
public sealed record DotNetStageOption(ITimelineStage Stage, FrameCallbackMode Mode) : TimelineStageOption;
