// dotnet/JsTimeline.Blazor.Tests/TestFiles.cs
using System.Reflection;
using System.Text.Json;
using Json.Schema;

namespace JsTimeline.Blazor.Tests;

/// <summary>Files of the repository used by the tests: the schema and its examples.</summary>
internal static class TestFiles
{
    public static string RepoRoot { get; } = typeof(TestFiles).Assembly
        .GetCustomAttributes<AssemblyMetadataAttribute>()
        .Single(a => a.Key == "JsTimelineRepoRoot").Value!;

    public static string SchemaPath => Path.Combine(RepoRoot, "schema", "timeline.schema.json");

    public static string ReadExample(string name) => File.ReadAllText(Path.Combine(RepoRoot, "schema", "examples", name));

    public static IEnumerable<object[]> ExampleNames() =>
        Directory.GetFiles(Path.Combine(RepoRoot, "schema", "examples"), "*.json")
            .Select(path => Path.GetFileName(path))
            .Order(StringComparer.Ordinal)
            .Select(name => new object[] { name });

    private static readonly Lazy<JsonSchema> Schema = new(() => JsonSchema.FromText(File.ReadAllText(SchemaPath)));

    /// <summary>Checks a JSON text against schema/timeline.schema.json and returns the errors (empty when valid).</summary>
    public static IReadOnlyList<string> SchemaErrors(string json)
    {
        using var document = JsonDocument.Parse(json);
        var result = Schema.Value.Evaluate(document.RootElement, new EvaluationOptions { OutputFormat = OutputFormat.List });
        if (result.IsValid)
        {
            return Array.Empty<string>();
        }
        return (result.Details ?? [])
            .Where(d => d.Errors is not null)
            .SelectMany(d => d.Errors!.Select(e => $"{d.InstanceLocation}: {e.Value}"))
            .DefaultIfEmpty("invalid")
            .ToList();
    }
}
