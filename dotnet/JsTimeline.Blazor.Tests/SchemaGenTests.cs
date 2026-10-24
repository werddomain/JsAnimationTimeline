// dotnet/JsTimeline.Blazor.Tests/SchemaGenTests.cs
using JsTimeline.SchemaGen;

namespace JsTimeline.Blazor.Tests;

public sealed class SchemaGenTests
{
    private static string Generate(string schema) => ModelGenerator.Generate(schema, "Test.Model", "test.json");

    [Fact]
    public void Real_schema_generates_the_expected_types_and_is_stable()
    {
        var schema = File.ReadAllText(TestFiles.SchemaPath);

        var first = Generate(schema);

        Assert.Equal(first, Generate(schema));
        Assert.Contains("public sealed record TimelineDocument", first, StringComparison.Ordinal);
        Assert.Contains("public abstract record LayerNode", first, StringComparison.Ordinal);
        Assert.Contains("public sealed record Layer : LayerNode", first, StringComparison.Ordinal);
        Assert.Contains("public sealed record LayerTarget : IJsonOnDeserialized, IJsonOnSerializing", first, StringComparison.Ordinal);
        Assert.Contains("public enum SpanKind", first, StringComparison.Ordinal);
        // The variants of the flat target are folded into LayerTarget.
        Assert.DoesNotContain("record SelectorTarget", first, StringComparison.Ordinal);
        Assert.DoesNotContain("record RefTarget", first, StringComparison.Ordinal);
        Assert.DoesNotContain('\r', first);
    }

    [Theory]
    [InlineData("ease-in-out", "EaseInOut")]
    [InlineData("totalFrames", "TotalFrames")]
    [InlineData("ref", "Ref")]
    public void Pascal_names(string json, string expected) => Assert.Equal(expected, Naming.Pascal(json));

    [Theory]
    [InlineData("ref", "@ref")]
    [InlineData("stage", "stage")]
    [InlineData("total-frames", "totalFrames")]
    public void Parameter_names(string json, string expected) => Assert.Equal(expected, Naming.Parameter(json));

    [Theory]
    [InlineData("1st")]
    [InlineData("-")]
    public void Names_that_cannot_be_identifiers_are_refused(string json) =>
        Assert.Throws<NotSupportedException>(() => Naming.Pascal(json));

    [Fact]
    public void Shared_word_suffix_is_dropped_from_variant_names()
    {
        Assert.Equal(["Selector", "Ref"], SchemaReader.DistinctPrefixes(["SelectorTarget", "RefTarget"]));
        Assert.Equal(["Circle", "Square"], SchemaReader.DistinctPrefixes(["Circle", "Square"]));
    }

    [Fact]
    public void Multi_line_descriptions_stay_on_one_generated_line()
    {
        const string schema = """{"$defs":{"A":{"type":"object","description":"first\nsecond","properties":{"b":{"type":"string"}}}}}""";

        var code = Generate(schema);

        Assert.Contains("/// <summary>first second</summary>", code, StringComparison.Ordinal);
    }

    [Fact]
    public void Enum_values_keep_their_exact_json_text()
    {
        const string schema = """{"$defs":{"Mode":{"type":"string","enum":["ease-in","linear"]}}}""";

        var code = Generate(schema);

        Assert.Contains("EaseIn,", code, StringComparison.Ordinal);
        Assert.Contains("\"ease-in\" => Mode.EaseIn,", code, StringComparison.Ordinal);
        Assert.Contains("Mode.EaseIn => \"ease-in\",", code, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("no $defs", """{"type":"object"}""")]
    [InlineData("null type", """{"$defs":{"A":{"type":"null"}}}""")]
    [InlineData("numeric enum", """{"$defs":{"A":{"type":"integer","enum":[1,2]}}}""")]
    [InlineData("external $ref", """{"$defs":{"A":{"type":"object","properties":{"b":{"$ref":"other.json#/B"}}}}}""")]
    [InlineData("open flat variant", """{"$defs":{"A":{"type":"object","properties":{"t":{"oneOf":[{"$ref":"#/$defs/B"},{"$ref":"#/$defs/C"}]}}},"B":{"type":"object","required":["b"],"properties":{"b":{"type":"string"}}},"C":{"type":"object","additionalProperties":false,"required":["c"],"properties":{"c":{"type":"string"}}}}}""")]
    [InlineData("flat variant without required key", """{"$defs":{"A":{"type":"object","properties":{"t":{"oneOf":[{"$ref":"#/$defs/B"},{"$ref":"#/$defs/C"}]}}},"B":{"type":"object","additionalProperties":false,"properties":{"b":{"type":"string"}}},"C":{"type":"object","additionalProperties":false,"required":["c"],"properties":{"c":{"type":"string"}}}}}""")]
    [InlineData("dangling $ref", """{"$defs":{"A":{"type":"object","properties":{"b":{"$ref":"#/$defs/Missing"}}}}}""")]
    [InlineData("non-string const", """{"$defs":{"A":{"type":"object","properties":{"b":{"const":true}}}}}""")]
    [InlineData("single variant", """{"$defs":{"A":{"oneOf":[{"$ref":"#/$defs/B"}]},"B":{"type":"object","properties":{"b":{"type":"string"}}}}}""")]
    public void Unsupported_schema_shapes_fail_loudly(string reason, string schema)
    {
        var error = Assert.Throws<NotSupportedException>(() => Generate(schema));
        Assert.False(string.IsNullOrEmpty(error.Message), reason);
    }
}
