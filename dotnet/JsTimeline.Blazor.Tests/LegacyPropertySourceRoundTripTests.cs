// dotnet/JsTimeline.Blazor.Tests/LegacyPropertySourceRoundTripTests.cs
using System.Text.Json.Nodes;
using JsTimeline.Blazor.Model;

namespace JsTimeline.Blazor.Tests;

public sealed class LegacyPropertySourceRoundTripTests
{
    [Fact]
    public void Migrated_legacy_curve_source_round_trips_without_changing_its_domain_or_easing()
    {
        const string json = """
            {"version":"2.0.0","settings":{"fps":24,"totalFrames":1200},"layers":[
              {"id":"layer","type":"layer","name":"Object","spans":[],"propertyTimelines":{
                "value":{"initialValue":{"kind":"number","value":5},
                  "keys":[{"frame":1001,"value":{"kind":"number","value":0}},{"frame":1101,"value":{"kind":"number","value":100}}],
                  "transitions":[{"id":"move","fromFrame":1001,"toFrame":1101,
                    "easing":{"kind":"bezier","x1":0.2,"y1":-1,"x2":0.8,"y2":2},
                    "source":{"start":1001,"end":1101,"legacyEasing":"cubic-bezier(0.2, -1, 0.8, 2)",
                      "keys":[{"frame":1001,"value":{"kind":"number","value":0}},{"frame":1041,"value":{"kind":"number","value":90}},{"frame":1101,"value":{"kind":"number","value":100}}]}}]}
              }}]}
            """;

        var document = TimelineJson.Deserialize(json);
        var layer = Assert.IsType<Layer>(Assert.Single(document.Layers));
        var track = layer.PropertyTimelines!["value"];
        var source = Assert.Single(track.Transitions!).Source!;

        Assert.Equal("cubic-bezier(0.2, -1, 0.8, 2)", source.LegacyEasing);
        Assert.Null(source.Easing);
        Assert.Equal(1001, source.Start);
        Assert.Equal(1101, source.End);
        Assert.Equal(3, source.Keys.Count);
        var written = TimelineJson.Serialize(document);
        Assert.True(JsonNode.DeepEquals(JsonNode.Parse(json), JsonNode.Parse(written)), written);
        Assert.Empty(TestFiles.SchemaErrors(written));
    }
}
