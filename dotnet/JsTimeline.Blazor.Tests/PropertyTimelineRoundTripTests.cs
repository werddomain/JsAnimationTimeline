// dotnet/JsTimeline.Blazor.Tests/PropertyTimelineRoundTripTests.cs
using System.Text.Json.Nodes;
using System.Text.Json;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Stage;

namespace JsTimeline.Blazor.Tests;

public sealed class PropertyTimelineRoundTripTests
{
    private const string Document = """
        {"version":"2.0.0","settings":{"fps":24,"totalFrames":100},"layers":[
          {"id":"layer","type":"layer","name":"Object","spans":[],"propertyTimelines":{
            "x":{"initialValue":{"kind":"number","value":0},"beforeFirst":"initial","label":"X","group":"Transform",
              "keys":[{"frame":1,"value":{"kind":"number","value":0}},{"frame":50,"value":{"kind":"number","value":50}}],
              "transitions":[{"id":"move","fromFrame":1,"toFrame":50,
                "easing":{"kind":"effect","family":"elastic","mode":"out","parameters":{"oscillations":3,"springiness":4}},
                "source":{"start":1,"end":100,"keys":[{"frame":1,"value":{"kind":"number","value":0}},{"frame":100,"value":{"kind":"number","value":100}}],
                  "easing":{"kind":"bezier","x1":0.2,"y1":-1,"x2":0.8,"y2":2}}}]},
            "text":{"initialValue":{"kind":"text","value":"Hello"},"keys":[]},
            "enabled":{"initialValue":{"kind":"boolean","value":true},"keys":[]},
            "color":{"initialValue":{"kind":"color","r":0,"g":0.5,"b":1,"a":1},"keys":[]}
          }}]}
        """;

    [Fact]
    public void Independent_properties_and_curve_sources_round_trip_without_loss()
    {
        var document = TimelineJson.Deserialize(Document);
        var layer = Assert.IsType<Layer>(Assert.Single(document.Layers));
        var tracks = Assert.IsAssignableFrom<IReadOnlyDictionary<string, PropertyTimeline>>(layer.PropertyTimelines);
        Assert.Equal(0, Assert.IsType<NumberPropertyValue>(tracks["x"].InitialValue).Value);
        Assert.Equal("Hello", Assert.IsType<TextPropertyValue>(tracks["text"].InitialValue).Value);
        Assert.True(Assert.IsType<BooleanPropertyValue>(tracks["enabled"].InitialValue).Value);
        Assert.Equal(0.5, Assert.IsType<ColorPropertyValue>(tracks["color"].InitialValue).G);
        var transition = Assert.Single(tracks["x"].Transitions!);
        Assert.Equal(PropertyEasingFamily.Elastic, Assert.IsType<EffectPropertyEasing>(transition.Easing).Family);
        Assert.Equal(-1, Assert.IsType<BezierPropertyEasing>(transition.Source!.Easing).Y1);
        var written = TimelineJson.Serialize(document);

        Assert.True(JsonNode.DeepEquals(JsonNode.Parse(Document), JsonNode.Parse(written)), written);
        Assert.Empty(TestFiles.SchemaErrors(written));
    }

    [Theory]
    [InlineData("\"kind\":\"number\"", "\"kind\":\"unknown\"")]
    [InlineData("\"value\":0", "\"value\":\"wrong\"")]
    [InlineData("\"kind\":\"color\"", "\"kind\":\"color\",\"extra\":true")]
    [InlineData("\"initialValue\":{\"kind\":\"text\",\"value\":\"Hello\"}", "\"initialValue\":null")]
    [InlineData("\"mode\":\"out\"", "\"mode\":\"sideways\"")]
    public void Malformed_typed_shapes_are_refused(string original, string replacement)
    {
        var json = Document.Replace(original, replacement, StringComparison.Ordinal);

        Assert.ThrowsAny<JsonException>(() => TimelineJson.Deserialize(json));
    }

    [Fact]
    public void Stage_layer_preserves_typed_properties_alongside_numeric_values()
    {
        const string json = """
            {"layerId":"typed","target":{"ref":"hero"},"values":{"x":20},"active":true,"visible":true,
              "propertyValues":{"x":{"kind":"number","value":20},"caption":{"kind":"text","value":"Hello"},
                "enabled":{"kind":"boolean","value":true},"color":{"kind":"color","r":0,"g":0.5,"b":1,"a":1}}}
            """;
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        var layer = JsonSerializer.Deserialize<TimelineStageLayerState>(json, options)!;
        var written = JsonSerializer.Serialize(layer, options);

        Assert.Equal(20, layer.Values["x"]);
        Assert.True(JsonNode.DeepEquals(JsonNode.Parse(json), JsonNode.Parse(written)), written);
    }
}
