// dotnet/JsTimeline.Blazor.Tests/TimelineStageTests.cs
using System.Text.Json;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Stage;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

/// <summary>The C# side of a .NET stage: description, frames, bridge, handle and stage options.</summary>
public sealed class TimelineStageTests
{
    /// <summary>The JSON options of Blazor's JS interop (camelCase, case-insensitive).</summary>
    private static readonly JsonSerializerOptions InteropJson = new(JsonSerializerDefaults.Web);

    public sealed class RecordingStage : ITimelineStage
    {
        public string Id { get; init; } = "dotnet";

        public IReadOnlyList<TimelineStageTarget> Targets { get; init; } = [new("hero", "Héros")];

        public IReadOnlyList<TimelineStageProperty> Properties { get; init; } =
            [new("frameIndex", Interpolation: TimelineInterpolation.Floor), new("volume", 1, Min: 0, Max: 1)];

        public List<TimelineStageFrame> Frames { get; } = new();

        public CancellationToken LastToken { get; private set; }

        public Func<Task> Render { get; set; } = () => Task.CompletedTask;

        public Task RenderAsync(TimelineStageFrame frame, CancellationToken cancellationToken)
        {
            Frames.Add(frame);
            LastToken = cancellationToken;
            return Render();
        }
    }

    [Fact]
    public void Description_names_the_mode_and_interpolations_as_the_script_expects()
    {
        var description = DotNetStageDescription.From(new RecordingStage(), FrameCallbackMode.IntegerFrames);

        var json = JsonSerializer.Serialize(description, InteropJson);

        Assert.Contains("\"mode\":\"integerFrames\"", json, StringComparison.Ordinal);
        Assert.Contains("\"interpolation\":\"floor\"", json, StringComparison.Ordinal);
        Assert.Contains("\"interpolation\":\"linear\"", json, StringComparison.Ordinal);
        Assert.Contains("\"ref\":\"hero\"", json, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(FrameCallbackMode.Off, "off")]
    [InlineData(FrameCallbackMode.IntegerFrames, "integerFrames")]
    [InlineData(FrameCallbackMode.EveryTick, "everyTick")]
    public void Every_frame_mode_has_its_script_name(FrameCallbackMode mode, string expected) =>
        Assert.Equal(expected, DotNetStageDescription.From(new RecordingStage(), mode).Mode);

    [Fact]
    public void Every_interpolation_has_its_script_name()
    {
        var stage = new RecordingStage
        {
            Properties = Enum.GetValues<TimelineInterpolation>().Select((i, n) => new TimelineStageProperty($"p{n}", Interpolation: i)).ToList(),
        };

        var names = DotNetStageDescription.From(stage, FrameCallbackMode.Off).Properties.Select(p => p.Interpolation);

        Assert.Equal(["linear", "step", "floor", "round"], names);
    }

    public static TheoryData<string, RecordingStage> InvalidStages() => new()
    {
        { "empty id", new RecordingStage { Id = "" } },
        { "empty ref", new RecordingStage { Targets = [new("", "x")] } },
        { "duplicate ref", new RecordingStage { Targets = [new("a", "A"), new("a", "B")] } },
        { "empty label", new RecordingStage { Targets = [new("a", "")] } },
        { "bad name", new RecordingStage { Properties = [new("1st")] } },
        { "reserved name", new RecordingStage { Properties = [new("constructor")] } },
        { "duplicate name", new RecordingStage { Properties = [new("v"), new("v")] } },
        { "infinite default", new RecordingStage { Properties = [new("v", double.PositiveInfinity)] } },
        { "NaN bound", new RecordingStage { Properties = [new("v", Min: double.NaN)] } },
        { "min above max", new RecordingStage { Properties = [new("v", Min: 2, Max: 1)] } },
        { "name with final line break", new RecordingStage { Properties = [new("abc\n")] } },
        { "default outside bounds", new RecordingStage { Properties = [new("v", 5, Min: 0, Max: 1)] } },
        { "blank label", new RecordingStage { Targets = [new("a", "  ")] } },
        { "bad target property", new RecordingStage { Targets = [new("a", "A", Properties: ["x", "2d"])] } },
        { "repeated target property", new RecordingStage { Targets = [new("a", "A", Properties: ["x", "x"])] } },
    };

    [Theory]
    [MemberData(nameof(InvalidStages))]
    public void An_invalid_stage_is_refused_with_a_clear_message(string reason, RecordingStage stage)
    {
        var error = Assert.Throws<ArgumentException>(() => DotNetStageDescription.From(stage, FrameCallbackMode.IntegerFrames));

        Assert.False(string.IsNullOrEmpty(error.Message), reason);
    }

    [Fact]
    public void A_frame_sent_by_the_script_reads_into_the_model()
    {
        const string json = """
            {"released":[{"layerId":"l-old","target":{"ref":"old","stage":"dotnet"}}],"timeMs":400,"frame":5.5,"integerFrame":5,"layers":[
              {"layerId":"l-hero","target":{"ref":"hero","stage":"dotnet"},"values":{"x":40,"frameIndex":4},"active":true,"visible":false}]}
            """;

        var frame = JsonSerializer.Deserialize<TimelineStageFrame>(json, InteropJson)!;

        Assert.Equal([new TimelineStageReleasedLayer("l-old", LayerTarget.FromRef("old", "dotnet"))], frame.Released);
        Assert.Equal(5, frame.IntegerFrame);
        var layer = Assert.Single(frame.Layers);
        Assert.Equal(LayerTarget.FromRef("hero", "dotnet"), layer.Target);
        Assert.Equal(4, layer.Values["frameIndex"]);
        Assert.True(layer.Active);
        Assert.False(layer.Visible);
    }

    [Fact]
    public async Task Bridge_forwards_frames_until_disposed_and_cancels_on_dispose()
    {
        var stage = new RecordingStage();
        var bridge = new DotNetStageBridge(stage);
        var frame = new TimelineStageFrame(0, 1, 1, [], []);

        await bridge.RenderAsync(frame);
        var token = stage.LastToken;
        bridge.Dispose();
        await bridge.RenderAsync(frame);
        bridge.Dispose();

        Assert.Single(stage.Frames);
        Assert.True(token.IsCancellationRequested);
    }

    [Fact]
    public async Task Bridge_treats_a_cancelled_render_after_dispose_as_the_end_not_an_error()
    {
        var bridge = new DotNetStageBridge(new RecordingStage
        {
            Render = () => throw new OperationCanceledException(),
        });
        var started = new TimelineStageFrame(0, 1, 1, [], []);
        var stage = new RecordingStage();
        var gate = new TaskCompletionSource();
        stage.Render = async () =>
        {
            await gate.Task;
            stage.LastToken.ThrowIfCancellationRequested();
        };
        var cancelling = new DotNetStageBridge(stage);

        var rendering = cancelling.RenderAsync(started);
        cancelling.Dispose();
        gate.SetResult();
        await rendering;

        Assert.True(stage.LastToken.IsCancellationRequested);
        await Assert.ThrowsAsync<OperationCanceledException>(() => bridge.RenderAsync(started));
    }

    [Fact]
    public void Description_copies_the_lists_of_the_stage()
    {
        var shown = new List<string> { "x" };
        var stage = new RecordingStage { Targets = [new("hero", "Héros", Properties: shown)] };

        var description = DotNetStageDescription.From(stage, FrameCallbackMode.IntegerFrames);
        shown.Add("y");

        Assert.Equal(["x"], description.Targets[0].Properties);
    }

    [Fact]
    public async Task Handle_stops_the_script_while_the_receiver_is_still_alive()
    {
        var js = new FakeJsRuntime();
        var jsStage = new FakeJsObject();
        DotNetObjectReference<DotNetStageBridge>? receiver = null;
        js.Module.Handler = (identifier, args) =>
        {
            receiver = (DotNetObjectReference<DotNetStageBridge>)args![1]!;
            return identifier == "createDotNetStage" ? jsStage : null;
        };
        var receiverAliveAtStop = false;
        jsStage.Handler = (identifier, _) =>
        {
            if (identifier == "stop")
            {
                // Value throws ObjectDisposedException once the reference is disposed.
                receiverAliveAtStop = receiver!.Value is not null;
            }
            return null;
        };
        var handle = await DotNetStageHandle.CreateAsync(js, new RecordingStage(), FrameCallbackMode.IntegerFrames);

        await handle.DisposeAsync();

        Assert.Equal(["stop"], jsStage.Calls);
        Assert.True(receiverAliveAtStop);
        Assert.True(jsStage.Disposed);
    }

    [Fact]
    public async Task Handle_releases_everything_even_when_stop_fails()
    {
        var js = new FakeJsRuntime();
        var jsStage = new FakeJsObject { Handler = (_, _) => throw new JSException("page gone") };
        js.Module.Handler = (identifier, _) => identifier == "createDotNetStage" ? jsStage : null;
        var handle = await DotNetStageHandle.CreateAsync(js, new RecordingStage(), FrameCallbackMode.IntegerFrames);

        await handle.DisposeAsync();

        Assert.True(jsStage.Disposed);
        Assert.True(js.Module.Disposed);
    }

    [Fact]
    public async Task Handle_waits_for_a_running_render_on_dispose()
    {
        var js = new FakeJsRuntime();
        var jsStage = new FakeJsObject();
        DotNetObjectReference<DotNetStageBridge>? receiver = null;
        js.Module.Handler = (identifier, args) =>
        {
            receiver = (DotNetObjectReference<DotNetStageBridge>)args![1]!;
            return identifier == "createDotNetStage" ? jsStage : null;
        };
        var finish = new TaskCompletionSource();
        var stage = new RecordingStage { Render = () => finish.Task };
        var handle = await DotNetStageHandle.CreateAsync(js, stage, FrameCallbackMode.IntegerFrames);
        var rendering = receiver!.Value.RenderAsync(new TimelineStageFrame(0, 1, 1, [], []));

        var disposing = handle.DisposeAsync().AsTask();
        await Task.Delay(50);
        var waited = !disposing.IsCompleted;
        finish.SetResult();
        await disposing;
        await rendering;

        Assert.True(waited);
        Assert.True(stage.LastToken.IsCancellationRequested);
    }

    [Fact]
    public async Task Handle_creation_cancelled_before_it_starts_calls_no_script()
    {
        var js = new FakeJsRuntime();
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            DotNetStageHandle.CreateAsync(js, new RecordingStage(), FrameCallbackMode.IntegerFrames, cancelled.Token));

        Assert.Empty(js.Module.Calls);
    }

    [Fact]
    public async Task Bridge_lets_a_stage_failure_reach_the_script()
    {
        var stage = new RecordingStage { Render = () => throw new InvalidOperationException("device unplugged") };
        using var bridge = new DotNetStageBridge(stage);

        await Assert.ThrowsAsync<InvalidOperationException>(() => bridge.RenderAsync(new TimelineStageFrame(0, 1, 1, [], [])));
    }

    [Fact]
    public async Task Handle_builds_the_script_stage_and_releases_everything()
    {
        var js = new FakeJsRuntime();
        object?[]? arguments = null;
        var jsStage = new FakeJsObject();
        js.Module.Handler = (identifier, args) =>
        {
            arguments = args;
            return identifier == "createDotNetStage" ? jsStage : null;
        };

        var handle = await DotNetStageHandle.CreateAsync(js, new RecordingStage(), FrameCallbackMode.EveryTick);
        await handle.DisposeAsync();
        await handle.DisposeAsync();

        Assert.Same(jsStage, handle.JsStage);
        var description = Assert.IsType<DotNetStageDescription>(arguments![0]);
        Assert.Equal("everyTick", description.Mode);
        Assert.IsType<DotNetObjectReference<DotNetStageBridge>>(arguments[1]);
        Assert.True(jsStage.Disposed);
        Assert.True(js.Module.Disposed);
    }

    [Fact]
    public async Task Handle_refuses_an_invalid_stage_before_any_script_call()
    {
        var js = new FakeJsRuntime();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            DotNetStageHandle.CreateAsync(js, new RecordingStage { Id = " " }, FrameCallbackMode.IntegerFrames));

        Assert.Empty(js.Module.Calls);
    }

    [Fact]
    public async Task Handle_releases_the_module_when_the_script_refuses_the_stage()
    {
        var js = new FakeJsRuntime();
        js.Module.Handler = (_, _) => throw new JSException("unknown interpolation");

        await Assert.ThrowsAsync<JSException>(() =>
            DotNetStageHandle.CreateAsync(js, new RecordingStage(), FrameCallbackMode.IntegerFrames));

        Assert.True(js.Module.Disposed);
    }

    [Fact]
    public void Stage_options_describe_each_choice()
    {
        var stage = new RecordingStage();

        Assert.IsType<HtmlStageOption>(TimelineStageOption.Html());
        Assert.IsType<NoStageOption>(TimelineStageOption.None());
        Assert.Equal(TimelineStageOption.Html(), TimelineStageOption.Html());
        Assert.Equal(TimelineStageOption.JsModule("./a.js"), TimelineStageOption.JsModule("./a.js"));
        Assert.NotEqual(TimelineStageOption.DotNet(stage), TimelineStageOption.DotNet(stage, FrameCallbackMode.EveryTick));
        Assert.Equal(TimelineStageOption.DotNet(stage), TimelineStageOption.DotNet(stage));
        Assert.Equal("./js/myStage.js", Assert.IsType<JsModuleStageOption>(TimelineStageOption.JsModule("./js/myStage.js")).ModulePath);
        var dotNet = Assert.IsType<DotNetStageOption>(TimelineStageOption.DotNet(stage));
        Assert.Same(stage, dotNet.Stage);
        Assert.Equal(FrameCallbackMode.IntegerFrames, dotNet.Mode);
    }

    [Fact]
    public void Stage_options_refuse_missing_values()
    {
        Assert.Throws<ArgumentException>(() => TimelineStageOption.JsModule(" "));
        Assert.Throws<ArgumentNullException>(() => TimelineStageOption.DotNet(null!));
        Assert.Throws<ArgumentOutOfRangeException>(() => TimelineStageOption.DotNet(new RecordingStage(), (FrameCallbackMode)42));
    }
}
