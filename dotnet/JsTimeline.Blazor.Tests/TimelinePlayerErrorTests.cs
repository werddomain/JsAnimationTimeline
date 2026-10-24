// dotnet/JsTimeline.Blazor.Tests/TimelinePlayerErrorTests.cs
using Bunit;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Player;
using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

/// <summary>
/// How <see cref="TimelinePlayer"/> reports errors: one path for creation, parameter applications and
/// stage errors, which keeps the original error when OnError throws and stops after disposal.
/// </summary>
public sealed class TimelinePlayerErrorTests : BunitContext
{
    private static TimelineDocument Document(int totalFrames = 24) => new()
    {
        Version = "2.0.0",
        Settings = new TimelineSettings { Fps = 24, TotalFrames = totalFrames },
        Layers = [],
    };

    private FakeJsRuntime UseFakeJs()
    {
        var js = new FakeJsRuntime();
        Services.AddSingleton<IJSRuntime>(js);
        return js;
    }

    /// <summary>Asserts the thrown error keeps both the handler's failure and the original error.</summary>
    private static void AssertKeepsBoth(Exception thrown, string failure, string original)
    {
        var wrapper = Assert.IsType<InvalidOperationException>(thrown);
        Assert.Contains("threw while handling", wrapper.Message, StringComparison.Ordinal);
        var inner = Assert.IsType<AggregateException>(wrapper.InnerException);
        Assert.Equal([failure, original], inner.InnerExceptions.Select(e => e.Message));
    }

    [Fact]
    public void A_throwing_OnError_at_creation_keeps_the_refused_document_error()
    {
        var js = UseFakeJs();
        js.CreateError = new JSException("invalid document");

        var thrown = Assert.ThrowsAny<Exception>(() => Render<TimelinePlayer>(ps => ps
            .Add(p => p.Data, Document())
            .Add(p => p.OnError, (Exception _) => throw new InvalidOperationException("handler failed"))));

        AssertKeepsBoth(thrown, "handler failed", "invalid document");
    }

    [Fact]
    public void A_throwing_OnError_on_an_update_keeps_the_error_and_still_receives_the_next_one()
    {
        var js = UseFakeJs();
        js.Player.Handler = (identifier, _) => identifier is "update" or "setLoop" ? throw new JSException(identifier) : null;
        var reported = new List<string>();
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, (Exception e) =>
        {
            reported.Add(e.Message);
            if (e.Message == "update")
            {
                throw new InvalidOperationException("handler failed");
            }
        }));

        var thrown = Assert.ThrowsAny<Exception>(() => cut.Render(ps => ps.Add(p => p.Data, Document(48)).Add(p => p.Loop, true)));

        Assert.Equal(["update", "setLoop"], reported);
        AssertKeepsBoth(thrown, "handler failed", "update");
    }

    [Fact]
    public async Task A_throwing_OnError_on_a_stage_error_is_dispatched_with_the_stage_error()
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
        Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document())
            .Add(p => p.OnError, (Exception _) => throw new InvalidOperationException("handler failed")));
        var sink = Assert.IsType<DotNetObjectReference<TimelinePlayerEventSink>>(createArguments![3]).Value;

        var handled = await sink.OnPlayerError("render failed");
        var dispatched = await Renderer.UnhandledException.WaitAsync(TimeSpan.FromSeconds(5));

        Assert.True(handled);
        AssertKeepsBoth(dispatched, "handler failed", "render failed");
    }

    [Fact]
    public async Task A_stage_error_handler_that_disposes_then_throws_reports_nothing()
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
        IRenderedComponent<TimelinePlayer>? cut = null;
        cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, async (Exception _) =>
        {
            await cut!.Instance.DisposeAsync();
            throw new InvalidOperationException("handler failed");
        }));
        var sink = Assert.IsType<DotNetObjectReference<TimelinePlayerEventSink>>(createArguments![3]).Value;
        var unhandled = Renderer.UnhandledException;

        // Completes once the handler and the check that follows it have run on the dispatcher.
        await sink.OnPlayerError("render failed");

        Assert.False(unhandled.IsCompleted);
    }

    [Fact]
    public async Task Errors_left_when_the_player_is_disposed_by_OnError_are_dropped()
    {
        var js = UseFakeJs();
        js.Player.Handler = (identifier, _) => identifier is "update" or "setLoop" ? throw new JSException(identifier) : null;
        var reported = new List<string>();
        IRenderedComponent<TimelinePlayer>? cut = null;
        cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()).Add(p => p.OnError, async (Exception e) =>
        {
            reported.Add(e.Message);
            await cut!.Instance.DisposeAsync();
        }));

        await cut.InvokeAsync(() => cut.Render(ps => ps.Add(p => p.Data, Document(48)).Add(p => p.Loop, true)));

        Assert.Equal(["update"], reported);
    }

    [Fact]
    public async Task Errors_left_after_disposal_are_not_thrown_without_OnError()
    {
        var js = UseFakeJs();
        var update = new TaskCompletionSource();
        js.Player.Handler = (identifier, _) => identifier == "update" ? update.Task : null;
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));
        var unhandled = Renderer.UnhandledException;

        cut.Render(ps => ps.Add(p => p.Data, Document(48)));
        await cut.InvokeAsync(() => cut.Instance.DisposeAsync().AsTask());
        // Fails the update on the dispatcher: the application and its report finish inside this call.
        await cut.InvokeAsync(() => update.SetException(new JSException("refused")));
        await cut.InvokeAsync(() => { });

        Assert.False(unhandled.IsCompleted);
    }

    [Fact]
    public async Task Coalesced_parameters_without_OnError_throw_the_refused_document_once()
    {
        var js = UseFakeJs();
        var release = new TaskCompletionSource();
        var updates = 0;
        js.Player.Handler = (identifier, _) =>
        {
            if (identifier != "update")
            {
                return null;
            }
            updates++;
            return updates == 1 ? release.Task : throw new JSException("refused");
        };
        var cut = Render<TimelinePlayer>(ps => ps.Add(p => p.Data, Document()));
        cut.Render(ps => ps.Add(p => p.Data, Document(48)));

        // While the first update runs, two more parameter sets queue a single application, owned by
        // the first of them: the later ones return at once and throw nothing.
        cut.Render(ps => ps.Add(p => p.Data, Document(60)));
        cut.Render(ps => ps.Add(p => p.Data, Document(72)));
        // Captured before the application runs: the whole chain completes inline in the next call.
        var unhandled = Renderer.UnhandledException;
        await cut.InvokeAsync(release.SetResult);

        var thrown = await unhandled.WaitAsync(TimeSpan.FromSeconds(5));
        await cut.InvokeAsync(() => { });

        Assert.Equal("refused", thrown.Message);
        Assert.Equal(2, updates);
        // No second throw: bUnit gives a new task after each caught exception, so the renderer
        // still holds the task completed by the first and only one.
        Assert.Same(unhandled, Renderer.UnhandledException);
    }
}
