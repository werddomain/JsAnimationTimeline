// dotnet/JsTimeline.Blazor.Tests/SampleStageTests.cs
using Bunit;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Stage;
using BlazorSample.Components;

namespace JsTimeline.Blazor.Tests;

public sealed class SampleStageTests : BunitContext
{
    [Fact]
    public async Task Applies_layers_after_releases_and_ignores_unknown_releases()
    {
        var cut = Render<SceneDisplay>();
        var stage = (ITimelineStage)cut.Instance;
        var hero = LayerTarget.FromRef("hero", "dotnet");
        await stage.RenderAsync(Frame([new("layer", hero, new Dictionary<string, double> { ["progress"] = 75 }, true)], []), CancellationToken.None);
        Assert.Contains("75", cut.Find("[data-testid=stage-value]").TextContent);
        await stage.RenderAsync(Frame([new("layer", hero, new Dictionary<string, double> { ["progress"] = 25 }, true)], [new("unknown", hero), new("layer", hero)]), CancellationToken.None);
        Assert.Contains("25", cut.Find("[data-testid=stage-value]").TextContent);
        await stage.RenderAsync(Frame([], [new("layer", hero)]), CancellationToken.None);
        Assert.Contains("0", cut.Find("[data-testid=stage-value]").TextContent);
    }

    [Fact]
    public async Task Hidden_and_inactive_layers_clear_the_display_and_cancellation_does_not_update_it()
    {
        var cut = Render<SceneDisplay>();
        var stage = (ITimelineStage)cut.Instance;
        var hero = LayerTarget.FromRef("hero", "dotnet");
        var values = new Dictionary<string, double> { ["progress"] = 60 };
        await stage.RenderAsync(Frame([new("layer", hero, values, true)], []), CancellationToken.None);
        await stage.RenderAsync(Frame([new("layer", hero, values, true, false)], []), CancellationToken.None);
        Assert.Equal("0", cut.Find("[data-testid=stage-value]").TextContent);
        await stage.RenderAsync(Frame([new("layer", hero, values, false)], []), CancellationToken.None);
        Assert.Equal("0", cut.Find("[data-testid=stage-value]").TextContent);
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => stage.RenderAsync(Frame([new("layer", hero, values, true)], []), cancelled.Token));
        Assert.Equal("0", cut.Find("[data-testid=stage-value]").TextContent);
    }
    [Fact]
    public async Task Fractional_position_uses_css_decimal_separator_in_french_culture()
    {
        var previous = System.Globalization.CultureInfo.CurrentCulture;
        try
        {
            System.Globalization.CultureInfo.CurrentCulture = System.Globalization.CultureInfo.GetCultureInfo("fr-CA");
            var cut = Render<SceneDisplay>();
            var hero = LayerTarget.FromRef("hero", "dotnet");
            await ((ITimelineStage)cut.Instance).RenderAsync(Frame([new("layer", hero, new Dictionary<string, double> { ["progress"] = 12.25 }, true)], []), CancellationToken.None);
            Assert.Contains("translateX(24.5px)", cut.Find("[data-testid=stage-object]").GetAttribute("style"));
        }
        finally { System.Globalization.CultureInfo.CurrentCulture = previous; }
    }
    private static TimelineStageFrame Frame(IReadOnlyList<TimelineStageLayerState> layers, IReadOnlyList<TimelineStageReleasedLayer> released) => new(0, 1, 1, layers, released);
}
