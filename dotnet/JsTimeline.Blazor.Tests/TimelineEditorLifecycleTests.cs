// dotnet/JsTimeline.Blazor.Tests/TimelineEditorLifecycleTests.cs
using Bunit;
using JsTimeline.Blazor.Editor;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Stage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

public sealed class TimelineEditorLifecycleTests : BunitContext
{
    private static TimelineDocument Document() => new() { Version = "2.0.0", Settings = new TimelineSettings { Fps = 24, TotalFrames = 24 }, Layers = [] };

    [Fact]
    public async Task A_new_stage_waits_for_destroy_and_stop_of_the_previous_stage()
    {
        var js = new EditorJsRuntime();
        var destroy = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var stop = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        js.Editor.Handler = (name, _) => name == "destroy" ? destroy.Task : null;
        js.Stage.Handler = (name, _) => name == "stop" ? stop.Task : null;
        Services.AddSingleton<IJSRuntime>(js);
        var stage = new TimelineStageTests.RecordingStage();
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.Stage, TimelineStageOption.DotNet(stage)));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.DotNet(stage, FrameCallbackMode.EveryTick)));
        cut.Render();
        Assert.Equal(1, js.EditorModule.Calls.Count(x => x == "createTimelineEditor"));
        await cut.InvokeAsync(() => destroy.SetResult());
        cut.WaitForAssertion(() => Assert.Contains("stop", js.Stage.Calls));
        cut.Render();
        Assert.Equal(1, js.EditorModule.Calls.Count(x => x == "createTimelineEditor"));
        await cut.InvokeAsync(() => stop.SetResult());
        cut.WaitForAssertion(() => Assert.Equal(2, js.EditorModule.Calls.Count(x => x == "createTimelineEditor")));
    }

    [Fact]
    public async Task A_changed_stage_is_retried_after_the_old_creation_fails()
    {
        var js = new EditorJsRuntime();
        var creation = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var count = 0;
        js.EditorModule.Handler = (name, _) => name == "createTimelineEditor" ? ++count == 1 ? creation.Task : js.Editor : null;
        Services.AddSingleton<IJSRuntime>(js);
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.OnError, (Exception _) => { }));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.None()));
        await cut.InvokeAsync(() => creation.SetException(new JSException("old stage refused")));
        cut.WaitForAssertion(() => Assert.Equal(2, count));
        Assert.True(cut.Instance.IsReady);
    }

    [Fact]
    public void A_destroy_failure_is_reported_and_does_not_block_a_later_stage()
    {
        var js = new EditorJsRuntime();
        var errors = 0;
        js.Editor.Handler = (name, _) => name == "destroy" ? throw new JSException("destroy failed") : null;
        Services.AddSingleton<IJSRuntime>(js);
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.OnError, (Exception _) => errors++));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.None()));
        cut.WaitForAssertion(() => Assert.Equal(1, errors));
        js.Editor.Handler = (_, _) => null;
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.Html()));
        cut.WaitForAssertion(() => Assert.True(cut.Instance.IsReady));
    }

    [Fact]
    public async Task A_newer_stage_is_not_refused_when_an_older_release_fails()
    {
        var js = new EditorJsRuntime();
        var destroy = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstDestroy = true;
        js.Editor.Handler = (name, _) => name == "destroy" && firstDestroy ? destroy.Task : null;
        Services.AddSingleton<IJSRuntime>(js);
        var errors = 0;
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.OnError, (Exception _) => errors++));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.None()));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.JsModule("./new.js")));
        firstDestroy = false;
        await cut.InvokeAsync(() => destroy.SetException(new JSException("old release failed")));
        cut.WaitForAssertion(() => Assert.Equal(2, js.EditorModule.Calls.Count(x => x == "createTimelineEditor")));
        Assert.Equal(1, errors);
        Assert.True(cut.Instance.IsReady);
    }

    [Fact]
    public void Creation_and_cleanup_failures_are_both_reported()
    {
        var js = new EditorJsRuntime();
        js.Editor.Handler = (name, _) => name == "destroy" ? throw new JSException("cleanup failed") : null;
        Services.AddSingleton<IJSRuntime>(js);
        Exception? reported = null;
        Render<TimelineEditor>(p => p.Add(x => x.Data, Document())
            .Add(x => x.OnReady, () => throw new InvalidOperationException("ready failed"))
            .Add(x => x.OnError, (Exception error) => reported = error));
        var aggregate = Assert.IsType<AggregateException>(reported);
        Assert.Contains(aggregate.InnerExceptions, error => error.Message == "ready failed");
        Assert.Contains(aggregate.InnerExceptions, error => error.Message == "cleanup failed");
    }
    [Fact]
    public void Combined_failures_without_handler_keep_both_errors_for_the_renderer()
    {
        var js = new EditorJsRuntime();
        js.Editor.Handler = (name, _) => name == "destroy" ? throw new JSException("cleanup failed") : null;
        Services.AddSingleton<IJSRuntime>(js);
        var failure = Assert.Throws<InvalidOperationException>(() => Render<TimelineEditor>(p => p.Add(x => x.Data, Document())
            .Add(x => x.OnReady, () => throw new InvalidOperationException("ready failed"))));
        var errors = Assert.IsType<AggregateException>(failure.InnerException);
        Assert.Equal(2, errors.InnerExceptions.Count);
    }
    private sealed class EditorJsRuntime : IJSRuntime
    {
        public FakeJsObject EditorModule { get; } = new();
        public FakeJsObject Editor { get; } = new();
        public FakeJsObject StageModule { get; } = new();
        public FakeJsObject Stage { get; } = new();
        public EditorJsRuntime()
        {
            EditorModule.Handler = (name, _) => name == "createTimelineEditor" ? Editor : null;
            StageModule.Handler = (name, _) => name == "createDotNetStage" ? Stage : null;
        }
        public ValueTask<T> InvokeAsync<T>(string identifier, object?[]? args) =>
            new((T)(object)((string)args![0]! == "./_content/JsTimeline.Blazor/stage/dotnetStage.js" ? StageModule : EditorModule));
        public ValueTask<T> InvokeAsync<T>(string identifier, CancellationToken cancellationToken, object?[]? args) => InvokeAsync<T>(identifier, args);
    }
}


