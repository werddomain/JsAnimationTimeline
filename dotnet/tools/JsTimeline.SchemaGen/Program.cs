// dotnet/tools/JsTimeline.SchemaGen/Program.cs
using JsTimeline.SchemaGen;

// Usage: JsTimeline.SchemaGen <schema.json> <output.cs> <namespace> <source name>
if (args.Length != 4)
{
    Console.Error.WriteLine("Usage: JsTimeline.SchemaGen <schema.json> <output.cs> <namespace> <source name>");
    return 2;
}

var (schemaPath, outputPath, ns, sourceName) = (args[0], args[1], args[2], args[3]);
try
{
    var source = ModelGenerator.Generate(File.ReadAllText(schemaPath), ns, sourceName);
    // Same content: keep the file untouched so the compiler does not rebuild for nothing.
    if (File.Exists(outputPath) && File.ReadAllText(outputPath) == source)
    {
        return 0;
    }
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
    File.WriteAllText(outputPath, source);
    return 0;
}
catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException
    or System.Text.Json.JsonException or InvalidOperationException or ArgumentException or KeyNotFoundException)
{
    Console.Error.WriteLine($"{schemaPath}: error JSTL001: {ex.Message}");
    return 1;
}
