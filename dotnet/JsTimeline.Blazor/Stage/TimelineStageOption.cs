// dotnet/JsTimeline.Blazor/Stage/TimelineStageOption.cs
using System.Runtime.CompilerServices;

namespace JsTimeline.Blazor.Stage;

/// <summary>
/// What the timeline animates (the future <c>Stage</c> parameter of the editor component):
/// <see cref="Html"/> (the default), <see cref="JsModule"/>, <see cref="DotNet"/> or <see cref="None"/>.
/// Only these factories create options, so an option is always valid. Two options are equal when
/// they make the same choice (same module path, same stage instance and mode).
/// </summary>
public abstract class TimelineStageOption : IEquatable<TimelineStageOption>
{
    private protected TimelineStageOption()
    {
    }

    /// <summary>The HTML elements of the page, through the default HTML stage.</summary>
    public static TimelineStageOption Html() => HtmlStageOption.Instance;

    /// <summary>No stage: the timeline only edits the document (frames can still be read).</summary>
    public static TimelineStageOption None() => NoStageOption.Instance;

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

    /// <inheritdoc />
    public abstract bool Equals(TimelineStageOption? other);

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as TimelineStageOption);

    /// <inheritdoc />
    public abstract override int GetHashCode();

    /// <summary>Same choice (see <see cref="Equals(TimelineStageOption?)"/>), not same instance.</summary>
    public static bool operator ==(TimelineStageOption? left, TimelineStageOption? right) =>
        left is null ? right is null : left.Equals(right);

    /// <summary>Different choices.</summary>
    public static bool operator !=(TimelineStageOption? left, TimelineStageOption? right) => !(left == right);
}

/// <summary>The default HTML stage.</summary>
public sealed class HtmlStageOption : TimelineStageOption
{
    internal static readonly HtmlStageOption Instance = new();

    private HtmlStageOption()
    {
    }

    /// <inheritdoc />
    public override bool Equals(TimelineStageOption? other) => other is HtmlStageOption;

    /// <inheritdoc />
    public override int GetHashCode() => nameof(HtmlStageOption).GetHashCode(StringComparison.Ordinal);
}

/// <summary>No stage.</summary>
public sealed class NoStageOption : TimelineStageOption
{
    internal static readonly NoStageOption Instance = new();

    private NoStageOption()
    {
    }

    /// <inheritdoc />
    public override bool Equals(TimelineStageOption? other) => other is NoStageOption;

    /// <inheritdoc />
    public override int GetHashCode() => nameof(NoStageOption).GetHashCode(StringComparison.Ordinal);
}

/// <summary>A JavaScript stage module.</summary>
public sealed class JsModuleStageOption : TimelineStageOption
{
    internal JsModuleStageOption(string modulePath) => ModulePath = modulePath;

    /// <summary>Path of the module, relative to the app base.</summary>
    public string ModulePath { get; }

    /// <inheritdoc />
    public override bool Equals(TimelineStageOption? other) =>
        other is JsModuleStageOption module && string.Equals(module.ModulePath, ModulePath, StringComparison.Ordinal);

    /// <inheritdoc />
    public override int GetHashCode() => ModulePath.GetHashCode(StringComparison.Ordinal);
}

/// <summary>A C# stage.</summary>
public sealed class DotNetStageOption : TimelineStageOption
{
    internal DotNetStageOption(ITimelineStage stage, FrameCallbackMode mode) => (Stage, Mode) = (stage, mode);

    /// <summary>The stage.</summary>
    public ITimelineStage Stage { get; }

    /// <summary>When frames are sent to the stage.</summary>
    public FrameCallbackMode Mode { get; }

    /// <inheritdoc />
    public override bool Equals(TimelineStageOption? other) =>
        other is DotNetStageOption dotNet && ReferenceEquals(dotNet.Stage, Stage) && dotNet.Mode == Mode;

    /// <inheritdoc />
    // By reference, like Equals: a stage overriding GetHashCode must not change the option's hash.
    public override int GetHashCode() => HashCode.Combine(RuntimeHelpers.GetHashCode(Stage), Mode);
}
