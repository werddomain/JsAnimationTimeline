// dotnet/JsTimeline.Blazor/Stage/DotNetStageDescription.cs
using System.Text.RegularExpressions;

namespace JsTimeline.Blazor.Stage;

/// <summary>A property as sent to dotnetStage.js: the interpolation travels by name.</summary>
internal sealed record DotNetStagePropertyDescription(
    string Name,
    double DefaultValue,
    string Interpolation,
    string? Label,
    string? Group,
    string Unit,
    double? Min,
    double? Max);

/// <summary>
/// What dotnetStage.js needs to build the runtime stage: id, frame mode, targets and properties.
/// Built and checked once, when the stage is plugged in.
/// </summary>
internal sealed partial record DotNetStageDescription(
    string Id,
    string Mode,
    IReadOnlyList<TimelineStageTarget> Targets,
    IReadOnlyList<DotNetStagePropertyDescription> Properties)
{
    /// <summary>Reads and checks the stage. Throws <see cref="ArgumentException"/> on an invalid stage.</summary>
    public static DotNetStageDescription From(ITimelineStage stage, FrameCallbackMode mode)
    {
        ArgumentNullException.ThrowIfNull(stage);
        if (string.IsNullOrWhiteSpace(stage.Id))
        {
            throw new ArgumentException("A stage needs a non-empty Id.", nameof(stage));
        }
        var targets = stage.Targets ?? throw new ArgumentException($"Stage \"{stage.Id}\": Targets is null.", nameof(stage));
        var properties = stage.Properties ?? throw new ArgumentException($"Stage \"{stage.Id}\": Properties is null.", nameof(stage));
        CheckTargets(stage.Id, targets);
        CheckProperties(stage.Id, properties);
        return new DotNetStageDescription(
            stage.Id,
            ModeName(mode),
            targets.ToList(),
            properties.Select(Describe).ToList());
    }

    private static string ModeName(FrameCallbackMode mode) => mode switch
    {
        FrameCallbackMode.Off => "off",
        FrameCallbackMode.IntegerFrames => "integerFrames",
        FrameCallbackMode.EveryTick => "everyTick",
        _ => throw new ArgumentOutOfRangeException(nameof(mode), mode, "Unknown frame callback mode."),
    };

    private static string InterpolationName(TimelineInterpolation interpolation) => interpolation switch
    {
        TimelineInterpolation.Linear => "linear",
        TimelineInterpolation.Step => "step",
        TimelineInterpolation.Floor => "floor",
        TimelineInterpolation.Round => "round",
        _ => throw new ArgumentOutOfRangeException(nameof(interpolation), interpolation, "Unknown interpolation."),
    };

    private static DotNetStagePropertyDescription Describe(TimelineStageProperty p) =>
        new(p.Name, p.DefaultValue, InterpolationName(p.Interpolation), p.Label, p.Group, p.Unit ?? "", p.Min, p.Max);

    private static void CheckTargets(string stageId, IReadOnlyList<TimelineStageTarget> targets)
    {
        var refs = new HashSet<string>(StringComparer.Ordinal);
        foreach (var target in targets)
        {
            if (target is null || string.IsNullOrEmpty(target.Ref))
            {
                throw new ArgumentException($"Stage \"{stageId}\": every target needs a non-empty Ref.");
            }
            if (!refs.Add(target.Ref))
            {
                throw new ArgumentException($"Stage \"{stageId}\": two targets have the ref \"{target.Ref}\".");
            }
            if (string.IsNullOrEmpty(target.Label))
            {
                throw new ArgumentException($"Stage \"{stageId}\": target \"{target.Ref}\" needs a label.");
            }
        }
    }

    private static void CheckProperties(string stageId, IReadOnlyList<TimelineStageProperty> properties)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in properties)
        {
            if (property is null || !IsValidPropertyName(property.Name))
            {
                throw new ArgumentException(
                    $"Stage \"{stageId}\": \"{property?.Name}\" is not a valid property name (a letter, then letters or digits).");
            }
            if (!names.Add(property.Name))
            {
                throw new ArgumentException($"Stage \"{stageId}\": two properties are named \"{property.Name}\".");
            }
            var numbers = new[] { property.DefaultValue, property.Min ?? 0, property.Max ?? 0 };
            if (numbers.Any(n => !double.IsFinite(n)))
            {
                throw new ArgumentException($"Stage \"{stageId}\": property \"{property.Name}\" needs finite numbers.");
            }
            if (property.Min > property.Max)
            {
                throw new ArgumentException($"Stage \"{stageId}\": property \"{property.Name}\" has Min greater than Max.");
            }
        }
    }

    /// <summary>The rule of the schema and of the runtime registry: no <c>constructor</c> or <c>prototype</c>.</summary>
    internal static bool IsValidPropertyName(string? name) =>
        name is not null && PropertyName().IsMatch(name) && name is not "constructor" and not "prototype";

    [GeneratedRegex("^[a-zA-Z][a-zA-Z0-9]*$")]
    private static partial Regex PropertyName();
}
