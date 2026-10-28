// dotnet/samples/BlazorSample/Components/SampleDocuments.cs
using JsTimeline.Blazor.Model;

namespace BlazorSample.Components;

public static class SampleDocuments
{
    public static TimelineDocument Html(int frames = 24) => TimelineJson.Deserialize("""
        {"version":"2.0.0","settings":{"fps":24,"totalFrames":FRAME_COUNT},"layers":[{"id":"logo","type":"layer","name":"Logo","target":{"selector":"#logo"},"spans":[{"id":"motion","kind":"tween","start":1,"end":FRAME_COUNT,"tracks":{"x":[{"frame":1,"value":0},{"frame":FRAME_COUNT,"value":200}]}}]}]}
        """.Replace("FRAME_COUNT", frames.ToString(System.Globalization.CultureInfo.InvariantCulture)));
    public static TimelineDocument Scene() => TimelineJson.Deserialize("""
        {"version":"2.0.0","settings":{"fps":24,"totalFrames":24},"layers":[{"id":"hero-layer","type":"layer","name":"Voyageur","target":{"ref":"hero","stage":"dotnet"},"spans":[{"id":"travel","kind":"tween","start":1,"end":24,"tracks":{"progress":[{"frame":1,"value":0},{"frame":24,"value":100}]}}]}]}
        """);
}
