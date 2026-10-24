// dotnet/tools/JsTimeline.SchemaGen/ModelGenerator.cs
using System.Text.Json;
using System.Text.Json.Nodes;

namespace JsTimeline.SchemaGen;

/// <summary>Entry point of the generation: schema text in, C# source out.</summary>
internal static class ModelGenerator
{
    public static string Generate(string schemaJson, string ns, string sourceName)
    {
        var root = JsonNode.Parse(schemaJson, documentOptions: new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip })
            as JsonObject ?? throw new NotSupportedException("The schema root must be an object.");
        return ModelEmitter.Emit(SchemaReader.Read(root), ns, sourceName);
    }
}
