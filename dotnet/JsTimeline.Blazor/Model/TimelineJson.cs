// dotnet/JsTimeline.Blazor/Model/TimelineJson.cs
using System.Text.Json;

namespace JsTimeline.Blazor.Model;

/// <summary>Reads and writes timeline documents as JSON, in the format of schema/timeline.schema.json.</summary>
/// <remarks>
/// The model types carry their own JSON attributes, so any <see cref="JsonSerializerOptions"/> works;
/// these options only refuse comments and trailing commas, and are read-only.
/// </remarks>
public static class TimelineJson
{
    /// <summary>Options used by <see cref="Deserialize"/> and <see cref="Serialize"/>.</summary>
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    /// <summary>Reads a document. Throws <see cref="JsonException"/> when the JSON does not fit the model.</summary>
    /// <remarks>
    /// Only the shape is checked here (keys, types, target forms). The semantic rules (unique ids,
    /// contiguous spans...) are checked by <c>validateDocument</c> in the runtime package.
    /// </remarks>
    public static TimelineDocument Deserialize(string json)
    {
        ArgumentNullException.ThrowIfNull(json);
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions
        {
            AllowTrailingCommas = Options.AllowTrailingCommas,
            CommentHandling = Options.ReadCommentHandling,
        });
        // The schema allows null nowhere, but System.Text.Json (net8) lets it through for list items,
        // dictionary values and optional keys: refuse it before it reaches the model.
        ThrowOnNull(document.RootElement, "$");
        return document.RootElement.Deserialize<TimelineDocument>(Options)
            ?? throw new JsonException("The timeline document is null.");
    }

    /// <summary>Writes a document as compact JSON; absent optional values are left out.</summary>
    public static string Serialize(TimelineDocument document)
    {
        ArgumentNullException.ThrowIfNull(document);
        return JsonSerializer.Serialize(document, Options);
    }

    private static void ThrowOnNull(JsonElement element, string path)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Null:
                throw new JsonException($"{path} cannot be null.");
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    ThrowOnNull(property.Value, $"{path}.{property.Name}");
                }
                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    ThrowOnNull(item, $"{path}[{index++}]");
                }
                break;
        }
    }

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.General)
        {
            AllowTrailingCommas = false,
            ReadCommentHandling = JsonCommentHandling.Disallow,
        };
        options.MakeReadOnly(populateMissingResolver: true);
        return options;
    }
}
