// dotnet/JsTimeline.Blazor.Tests/TimelinePlayerLifecycleTests.cs
using Bunit;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Player;
using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

/// <summary>Creation, retry, teardown and error paths of <see cref="TimelinePlayer"/>.</summary>
public sealed class TimelinePlayerLifecycleTests : BunitContext
{
    private static TimelineDocument Document(int totalFrames = 24) => new()
    {
        Version = "2.0.0",
        Settings = new TimelineSettings { Fps = 24, TotalFrames = totalFrames },
        Layers = [],
    };

    private FakeJsRuntime UseFakeJs(bool resolveImport = true)
    {
        var js = new FakeJsRuntime(resolveImport);
        Services.AddSingleton<IJSRuntime>(js);
        return js;
    }

    private static int CreateCalls(FakeJsRuntime js) => js.Module.Calls.Count(c => c == "createTimelinePlayer");

    [Fact]
    public void A_new_document_after_a_refused_one_creates_the_player()
    {
        var js = UseFakeJs();
        js.CreateError = new JSException("Invalid timeline document");
        var errors = 0;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception _) => errors++));
        Assert.Equal(1, errors);

        js.CreateError = null;
        cut.Render(ps => ps.Add(p => p.Data, Document(48)));

        Assert.True(cut.Instance.IsReady);
        Assert.Equal(2, CreateCalls(js));
    }

    [Fact]
    public void The_same_refused_document_is_not_tried_again()
    {
        var js = UseFakeJs();
        js.CreateError = new JSException("Invalid timeline document");
        var errors = 0;
        var document = Document();
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, document).Add(p => p.OnError, (Exception _) => errors++));
        Assert.Equal(1, errors);

        cut.Render(ps => ps.Add(p => p.Data, document).Add(p => p.Loop, true));

        Assert.Equal(1, CreateCalls(js));
    }

    [Fact]
    public async Task Disposing_while_the_module_loads_releases_the_player_without_error()
    {
        var js = UseFakeJs(resolveImport: false);
        var ready = false;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnReady, () => ready = true));

        await cut.InvokeAsync(() => cut.Instance.DisposeAsync().AsTask());
        await cut.InvokeAsync(() => js.Import.SetResult(js.Module));
        await cut.InvokeAsync(() => { });

        Assert.True(js.Module.Disposed);
        Assert.Equal(["destroy"], js.Player.Calls);
        Assert.True(js.Player.Disposed);
        Assert.False(ready);
        Assert.False(cut.Instance.IsReady);
    }

    [Fact]
    public async Task A_disconnected_circuit_during_creation_is_not_an_error()
    {
        var js = UseFakeJs(resolveImport: false);
        var errors = 0;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception _) => errors++));

        await cut.InvokeAsync(() => js.Import.SetException(new JSDisconnectedException("gone")));
        await cut.InvokeAsync(() => { });

        Assert.Equal(0, errors);
        Assert.False(cut.Instance.IsReady);
    }

    [Fact]
    public async Task Disposal_releases_every_reference_even_when_destroy_fails()
    {
        var js = UseFakeJs();
        js.Player.Handler = (identifier, _) => identifier == "destroy" ? throw new JSException("boom") : null;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));
        Assert.True(cut.Instance.IsReady);

        await cut.InvokeAsync(() => cut.Instance.DisposeAsync().AsTask());

        Assert.True(js.Player.Disposed);
        Assert.True(js.Module.Disposed);
    }

    [Fact]
    public async Task Events_after_disposal_are_ignored()
    {
        var js = UseFakeJs();
        object?[]? createArguments = null;
        var create = js.Module.Handler;
        js.Module.Handler = (identifier, args) =>
        {
            if (identifier == "createTimelinePlayer")
            {
                createArguments = args;
            }
            return create(identifier, args);
        };
        var played = 0;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnPlay, () => played++));
        Assert.True(cut.Instance.IsReady);
        var sink = Assert.IsType<DotNetObjectReference<TimelinePlayerEventSink>>(createArguments![3]).Value;

        await cut.InvokeAsync(() => cut.Instance.DisposeAsync().AsTask());
        await sink.OnPlayerEvent("play", 1);

        Assert.Equal(0, played);
        Assert.False(cut.Instance.IsPlaying);
    }

    [Fact]
    public void A_refused_update_is_not_sent_again_but_loop_and_speed_still_apply()
    {
        var js = UseFakeJs();
        var refused = Document(48);
        js.Player.Handler = (identifier, args) =>
            identifier == "update" && (string)args![0]! == TimelineJson.Serialize(refused) ? throw new JSException("bad") : null;
        var errors = 0;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception _) => errors++));
        Assert.True(cut.Instance.IsReady);

        cut.Render(ps => ps.Add(p => p.Data, refused).Add(p => p.Loop, true));
        cut.Render(ps => ps.Add(p => p.Data, refused).Add(p => p.Speed, 2));

        Assert.Equal(1, errors);
        Assert.Single(js.Player.Calls, c => c == "update");
        Assert.Contains("setLoop", js.Player.Calls);
        Assert.Contains("setSpeed", js.Player.Calls);

        cut.Render(ps => ps.Add(p => p.Data, Document(60)));

        Assert.Equal(2, js.Player.Calls.Count(c => c == "update"));
    }

    [Fact]
    public void A_parent_re_rendered_by_OnError_does_not_loop_on_a_refused_update()
    {
        var js = UseFakeJs();
        js.Player.Handler = (identifier, _) => identifier == "update" ? throw new JSException("bad") : null;
        var host = Render<PlayerHost>(ps => ps.Add(p => p.Data, Document()));

        host.Render(ps => ps.Add(p => p.Data, Document(48)));

        Assert.Equal(1, host.Instance.Errors);
        Assert.Single(js.Player.Calls, c => c == "update");
    }

    /// <summary>A parent whose OnError handler re-renders it, like any component method handler.</summary>
    private sealed class PlayerHost : ComponentBase
    {
        [Parameter]
        public TimelineDocument Data { get; set; } = default!;

        public int Errors { get; private set; }

        protected override void BuildRenderTree(Microsoft.AspNetCore.Components.Rendering.RenderTreeBuilder builder)
        {
            builder.OpenComponent<TimelinePlayer>(0);
            builder.AddComponentParameter(1, nameof(TimelinePlayer.Data), Data);
            builder.AddComponentParameter(2, nameof(TimelinePlayer.OnError), EventCallback.Factory.Create<Exception>(this, _ => Errors++));
            builder.CloseComponent();
        }
    }
}
