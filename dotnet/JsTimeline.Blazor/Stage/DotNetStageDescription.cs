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
        // Each member of the stage is read once: a later change cannot make the description inconsistent.
        var id = stage.Id;
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("A stage needs a non-empty Id.", nameof(stage));
        }
        var targets = (stage.Targets ?? throw new ArgumentException($"Stage \"{id}\": Targets is null.", nameof(stage))).ToList();
        var properties = (stage.Properties ?? throw new ArgumentException($"Stage \"{id}\": Properties is null.", nameof(stage))).ToList();
        CheckTargets(id, targets);
        CheckProperties(id, properties);
        return new DotNetStageDescription(
            id,
            ModeName(mode),
            targets.Select(t => t with { Properties = t.Properties?.ToList() }).ToList(),
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
            if (string.IsNullOrWhiteSpace(target.Label))
            {
                throw new ArgumentException($"Stage \"{stageId}\": target \"{target.Ref}\" needs a label.");
            }
            CheckTargetProperties(stageId, target);
        }
    }

    /// <summary>
    /// The properties shown for one object: valid names, no duplicates. They may name built-in
    /// properties (x, rotation...) as well as the stage's own.
    /// </summary>
    private static void CheckTargetProperties(string stageId, TimelineStageTarget target)
    {
        if (target.Properties is null)
        {
            return;
        }
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var name in target.Properties)
        {
            if (!IsValidPropertyName(name) || !names.Add(name))
            {
                throw new ArgumentException(
                    $"Stage \"{stageId}\": target \"{target.Ref}\" lists \"{name}\", an invalid or repeated property name.");
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
            if (!double.IsFinite(property.DefaultValue)
                || property.Min is { } min && !double.IsFinite(min)
                || property.Max is { } max && !double.IsFinite(max))
            {
                throw new ArgumentException($"Stage \"{stageId}\": property \"{property.Name}\" needs finite numbers.");
            }
            if (property.Min > property.Max)
            {
                throw new ArgumentException($"Stage \"{stageId}\": property \"{property.Name}\" has Min greater than Max.");
            }
            if (property.DefaultValue < property.Min || property.DefaultValue > property.Max)
            {
                throw new ArgumentException(
                    $"Stage \"{stageId}\": the default value of \"{property.Name}\" is outside [Min, Max].");
            }
        }
    }

    /// <summary>The rule of the schema and of the runtime registry: no <c>constructor</c> or <c>prototype</c>.</summary>
    internal static bool IsValidPropertyName(string? name) =>
        name is not null && PropertyName().IsMatch(name) && name is not "constructor" and not "prototype";

    // \z, not $: in .NET, $ also matches before a final line break.
    [GeneratedRegex(@"^[a-zA-Z][a-zA-Z0-9]*\z")]
    private static partial Regex PropertyName();
}
