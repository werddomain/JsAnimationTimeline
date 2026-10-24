// dotnet/JsTimeline.Blazor.Tests/ModelRoundTripTests.cs
using System.Text.Json;
using System.Text.Json.Nodes;
using JsTimeline.Blazor.Model;

namespace JsTimeline.Blazor.Tests;

public sealed class ModelRoundTripTests
{
    private const string Head = """{"version":"2.0.0","settings":{"fps":24,"totalFrames":10}""";

    [Theory]
    [MemberData(nameof(TestFiles.ExampleNames), MemberType = typeof(TestFiles))]
    public void Example_round_trips_without_any_change(string example)
    {
        var original = TestFiles.ReadExample(example);

        var written = TimelineJson.Serialize(TimelineJson.Deserialize(original));

        Assert.True(JsonNode.DeepEquals(JsonNode.Parse(original), JsonNode.Parse(written)), written);
        Assert.Empty(TestFiles.SchemaErrors(written));
    }

    [Fact]
    public void Document_built_in_csharp_matches_the_schema_and_round_trips()
    {
        var written = TimelineJson.Serialize(SampleDocument());

        var rewritten = TimelineJson.Serialize(TimelineJson.Deserialize(written));

        Assert.Empty(TestFiles.SchemaErrors(written));
        Assert.Equal(written, rewritten);
    }

    [Fact]
    public void Schema_check_used_by_these_tests_catches_an_invalid_document()
    {
        var errors = TestFiles.SchemaErrors("""{"version":"1.0.0","settings":{"fps":0,"totalFrames":10},"layers":[]}""");

        Assert.NotEmpty(errors);
    }

    [Fact]
    public void Absent_optional_values_are_not_written()
    {
        var written = TimelineJson.Serialize(SampleDocument());

        var layer = JsonNode.Parse(written)!["layers"]![0]!.AsObject();
        Assert.False(layer.ContainsKey("color"));
        Assert.False(layer.ContainsKey("visible"));
        Assert.DoesNotContain("null", written, StringComparison.Ordinal);
    }

    [Fact]
    public void Node_type_is_read_wherever_it_is_in_the_object()
    {
        const string json = Head + """
            ,"layers":[{"id":"f","name":"Dossier","children":[{"spans":[],"name":"Calque","id":"l","type":"layer"}],"type":"folder"}]}
            """;

        var document = TimelineJson.Deserialize(json);

        var folder = Assert.IsType<Folder>(Assert.Single(document.Layers));
        var layer = Assert.IsType<Layer>(Assert.Single(folder.Children));
        Assert.Equal("l", layer.Id);
        Assert.Equal("layer", layer.Type);
    }

    [Theory]
    [InlineData("unknown key", Head + ""","layers":[],"extra":1}""")]
    [InlineData("missing required", """{"version":"2.0.0","settings":{"fps":24,"totalFrames":10}}""")]
    [InlineData("unknown node type", Head + ""","layers":[{"id":"a","type":"group","name":"x"}]}""")]
    [InlineData("node without type", Head + ""","layers":[{"id":"a","name":"x","spans":[]}]}""")]
    [InlineData("null node", Head + ""","layers":[null]}""")]
    [InlineData("unknown span kind", Head + ""","layers":[{"id":"a","type":"layer","name":"x","spans":[{"id":"s","start":1,"end":2,"kind":"motion"}]}]}""")]
    [InlineData("numeric span kind", Head + ""","layers":[{"id":"a","type":"layer","name":"x","spans":[{"id":"s","start":1,"end":2,"kind":0}]}]}""")]
    [InlineData("fractional frame", """{"version":"2.0.0","settings":{"fps":24,"totalFrames":10.5},"layers":[]}""")]
    [InlineData("trailing comma", Head + ""","layers":[],}""")]
    [InlineData("null required value", """{"version":null,"settings":{"fps":24,"totalFrames":10},"layers":[]}""")]
    [InlineData("null settings", """{"version":"2.0.0","settings":null,"layers":[]}""")]
    [InlineData("null span", Head + ""","layers":[{"id":"a","type":"layer","name":"x","spans":[null]}]}""")]
    [InlineData("null track", Head + ""","layers":[{"id":"a","type":"layer","name":"x","spans":[{"id":"s","start":1,"end":2,"kind":"static","tracks":{"x":null}}]}]}""")]
    [InlineData("null keyframe", Head + ""","layers":[{"id":"a","type":"layer","name":"x","spans":[{"id":"s","start":1,"end":2,"kind":"static","tracks":{"x":[null]}}]}]}""")]
    [InlineData("null optional key", Head + ""","layers":[{"id":"a","type":"layer","name":"x","color":null,"spans":[]}]}""")]
    [InlineData("null target key", Head + ""","layers":[{"id":"a","type":"layer","name":"x","target":{"selector":"#a","ref":null},"spans":[]}]}""")]
    public void Json_that_does_not_fit_the_model_is_refused(string reason, string json)
    {
        var error = Assert.ThrowsAny<JsonException>(() => TimelineJson.Deserialize(json));
        Assert.False(string.IsNullOrEmpty(error.Message), reason);
    }

    [Fact]
    public void Null_required_value_is_refused_even_without_TimelineJson()
    {
        var error = Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<Layer>("""{"id":"a","type":"layer","name":null,"spans":[]}"""));

        Assert.Contains("\"name\"", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Null_document_is_refused()
    {
        Assert.Throws<JsonException>(() => TimelineJson.Deserialize("null"));
        Assert.Throws<ArgumentNullException>(() => TimelineJson.Serialize(null!));
    }

    [Fact]
    public void Span_kinds_are_written_as_their_schema_strings()
    {
        var written = TimelineJson.Serialize(SampleDocument());

        Assert.Contains("\"kind\":\"tween\"", written, StringComparison.Ordinal);
        Assert.Contains("\"kind\":\"blank\"", written, StringComparison.Ordinal);
        Assert.Contains("\"kind\":\"static\"", written, StringComparison.Ordinal);
    }

    private static TimelineDocument SampleDocument() => new()
    {
        Version = "2.0.0",
        Settings = new TimelineSettings { Fps = 30, TotalFrames = 60 },
        Layers =
        [
            new Layer
            {
                Id = "l-hero",
                Name = "Héros",
                Target = LayerTarget.FromRef("hero", stage: "canvas"),
                Spans =
                [
                    new Span
                    {
                        Id = "s1",
                        Start = 1,
                        End = 48,
                        Kind = SpanKind.Tween,
                        Easing = "cubic-bezier(0.25, 0.1, 0.25, 1)",
                        Tracks = new Dictionary<string, IReadOnlyList<PropertyKeyframe>>
                        {
                            ["x"] = [new PropertyKeyframe { Frame = 1, Value = 0 }, new PropertyKeyframe { Frame = 48, Value = 320.5 }],
                            ["frameIndex"] = [new PropertyKeyframe { Frame = 1, Value = 0 }, new PropertyKeyframe { Frame = 48, Value = 11 }],
                        },
                    },
                    new Span { Id = "s2", Start = 49, End = 60, Kind = SpanKind.Static },
                ],
            },
            new Folder
            {
                Id = "f1",
                Name = "Décor",
                Color = "#e67e22",
                Collapsed = true,
                Children =
                [
                    new Layer
                    {
                        Id = "l-logo",
                        Name = "Logo",
                        Visible = false,
                        Locked = true,
                        Icon = "element",
                        Target = LayerTarget.FromSelector("#logo"),
                        Spans = [new Span { Id = "s3", Start = 1, End = 60, Kind = SpanKind.Blank }],
                    },
                ],
            },
        ],
    };
}
