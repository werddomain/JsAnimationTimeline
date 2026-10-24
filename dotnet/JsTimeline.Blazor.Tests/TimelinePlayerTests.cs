// dotnet/JsTimeline.Blazor.Tests/TimelinePlayerTests.cs
using Bunit;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Player;
using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

public sealed class TimelinePlayerTests : BunitContext
{
    private const string CreateFunction = "createTimelinePlayer";

    private readonly BunitJSModuleInterop _module;
    private readonly BunitJSInterop _player;

    public TimelinePlayerTests()
    {
        _module = JSInterop.SetupModule(TimelinePlayerInterop.ModulePath);
        _player = _module.SetupModule(invocation => invocation.Identifier == CreateFunction);
        _player.Mode = JSRuntimeMode.Loose;
    }

    private static TimelineDocument Document(int totalFrames = 24) => new()
    {
        Version = "2.0.0",
        Settings = new TimelineSettings { Fps = 24, TotalFrames = totalFrames },
        Layers =
        [
            new Layer
            {
                Id = "l1",
                Name = "Logo",
                Target = LayerTarget.FromSelector("#logo"),
                Spans = [new Span { Id = "s1", Start = 1, End = totalFrames, Kind = SpanKind.Static }],
            },
        ],
    };

    private JSRuntimeInvocation CreateInvocation() => Assert.Single(_module.Invocations[CreateFunction]);

    private TimelinePlayerEventSink Sink() =>
        Assert.IsType<DotNetObjectReference<TimelinePlayerEventSink>>(CreateInvocation().Arguments[3]).Value;

    [Fact]
    public void Renders_the_content_inside_an_element_with_the_given_attributes()
    {
        var cut = Render<TimelinePlayer>(ps => ps
            .Add(p => p.Data, Document())
            .AddUnmatched("class", "scene")
            .AddChildContent("<div id=\"logo\">Logo</div>"));

        cut.MarkupMatches("<div class=\"scene\"><div id=\"logo\">Logo</div></div>");
    }

    [Fact]
    public void Creates_the_player_on_the_rendered_element_with_the_document_and_options()
    {
        var document = Document();

        var cut = Render<TimelinePlayer>(ps => ps
            .Add(p => p.Data, document)
            .Add(p => p.Autoplay, true)
            .Add(p => p.Loop, true)
            .Add(p => p.Speed, 2));

        var arguments = CreateInvocation().Arguments;
        Assert.IsType<ElementReference>(arguments[0]);
        Assert.Equal(TimelineJson.Serialize(document), arguments[1]);
        Assert.Equal(new TimelinePlayerJsOptions(Autoplay: true, Loop: true, Speed: 2, NotifyFrames: false, NotifyErrors: false), arguments[2]);
        Assert.True(cut.Instance.IsReady);
    }

    [Fact]
    public void Frames_are_sent_only_when_OnFrame_has_a_handler()
    {
        Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnFrame, (int _) => { }));

        var options = Assert.IsType<TimelinePlayerJsOptions>(CreateInvocation().Arguments[2]);
        Assert.True(options.NotifyFrames);
    }

    [Fact]
    public void Stage_errors_are_sent_only_when_OnError_has_a_handler()
    {
        Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception _) => { }));

        var options = Assert.IsType<TimelinePlayerJsOptions>(CreateInvocation().Arguments[2]);
        Assert.True(options.NotifyErrors);
    }

    [Fact]
    public async Task A_stage_error_reaches_OnError_as_a_TimelineStageException()
    {
        Exception? reported = null;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception e) => reported = e));

        await Sink().OnPlayerError("render failed");

        var error = Assert.IsType<TimelineStageException>(reported);
        Assert.Equal("render failed", error.Message);
        Assert.True(cut.Instance.IsReady);
    }

    [Fact]
    public void OnReady_is_raised_once_the_player_exists()
    {
        var ready = 0;

        Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnReady, () => ready++));

        Assert.Equal(1, ready);
    }

    [Fact]
    public void Parameter_changes_are_sent_to_the_player()
    {
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));
        var next = Document(48);

        cut.Render(ps => ps.Add(p => p.Data, next).Add(p => p.Loop, true).Add(p => p.Speed, 0.5));

        Assert.Equal(TimelineJson.Serialize(next), Assert.Single(_player.Invocations["update"]).Arguments[0]);
        Assert.Equal(true, Assert.Single(_player.Invocations["setLoop"]).Arguments[0]);
        Assert.Equal(0.5, Assert.Single(_player.Invocations["setSpeed"]).Arguments[0]);
    }

    [Fact]
    public void Unchanged_parameters_send_nothing()
    {
        var document = Document();
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, document));

        cut.Render(ps => ps.Add(p => p.Data, document));

        Assert.Empty(_player.Invocations);
    }

    [Fact]
    public async Task Methods_call_the_player()
    {
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));

        await cut.InvokeAsync(cut.Instance.PlayAsync);
        await cut.InvokeAsync(cut.Instance.PauseAsync);
        await cut.InvokeAsync(() => cut.Instance.SeekAsync(12));

        _player.VerifyInvoke("play");
        _player.VerifyInvoke("pause");
        await cut.InvokeAsync(() => cut.Instance.RefreshTargetsAsync());
        await cut.InvokeAsync(() => cut.Instance.RefreshTargetsAsync("l1"));
        Assert.Equal([null, "l1"], _player.Invocations["refreshTargets"].Select(i => i.Arguments[0]));
        Assert.Equal(12, _player.VerifyInvoke("seek").Arguments[0]);
    }

    [Fact]
    public async Task GetStateAsync_returns_the_state_of_the_player()
    {
        var state = new TimelinePlayerState(5, true, 24, 24, 1000, ["l2"], [new TimelineStageWarning("unrouted", "No stage", null, "l3", null)]);
        _player.Setup<TimelinePlayerState>("getState").SetResult(state);
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));

        var result = await cut.InvokeAsync(cut.Instance.GetStateAsync);

        Assert.Same(state, result);
    }

    [Fact]
    public async Task SeekAsync_refuses_a_frame_below_1()
    {
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => cut.InvokeAsync(() => cut.Instance.SeekAsync(0)));
    }

    [Fact]
    public async Task Player_events_update_the_state_and_raise_the_callbacks()
    {
        var log = new List<string>();
        var cut = Render<TimelinePlayer>(ps => ps
            .Add(p => p.Data, Document())
            .Add(p => p.OnPlay, () => log.Add("play"))
            .Add(p => p.OnPause, () => log.Add("pause"))
            .Add(p => p.OnLoop, () => log.Add("loop"))
            .Add(p => p.OnComplete, () => log.Add("complete"))
            .Add(p => p.OnFrame, (int frame) => log.Add($"frame {frame}")));
        var sink = Sink();

        await sink.OnPlayerEvent("play", 1);
        Assert.True(cut.Instance.IsPlaying);
        await sink.OnPlayerEvent("frame", 7);
        Assert.Equal(7, cut.Instance.CurrentFrame);
        await sink.OnPlayerEvent("loop", 1);
        await sink.OnPlayerEvent("pause", 3);
        Assert.False(cut.Instance.IsPlaying);
        await sink.OnPlayerEvent("play", 3);
        await sink.OnPlayerEvent("complete", 24);
        await sink.OnPlayerEvent("unknown", 24);

        Assert.False(cut.Instance.IsPlaying);
        Assert.Equal(24, cut.Instance.CurrentFrame);
        Assert.Equal(["play", "frame 7", "loop", "pause", "play", "complete"], log);
    }

    [Fact]
    public void A_refused_document_goes_to_OnError()
    {
        Services.AddSingleton<IJSRuntime>(new FakeJsRuntime { CreateError = new JSException("Invalid timeline document") });
        Exception? reported = null;

        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception e) => reported = e));

        Assert.IsType<JSException>(reported);
        Assert.False(cut.Instance.IsReady);
    }

    [Fact]
    public async Task Methods_before_the_player_exists_say_so()
    {
        Services.AddSingleton<IJSRuntime>(new FakeJsRuntime { CreateError = new JSException("Invalid timeline document") });
        var reported = false;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception _) => reported = true));
        Assert.True(reported);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(cut.Instance.PlayAsync);

        Assert.Contains("not ready", error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    public void Speed_must_be_finite_and_positive(double speed)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.Speed, speed)));
    }

    [Fact]
    public void A_document_is_required()
    {
        Assert.Throws<InvalidOperationException>(() => Render<TimelinePlayer>());
    }

    [Fact]
    public async Task Disposing_destroys_the_player_once()
    {
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));

        await cut.Instance.DisposeAsync();
        await cut.Instance.DisposeAsync();

        _player.VerifyInvoke("destroy", calledTimes: 1);
        var error = await Assert.ThrowsAsync<InvalidOperationException>(cut.Instance.PauseAsync);
        Assert.Contains("disposed", error.Message, StringComparison.Ordinal);
    }
}
