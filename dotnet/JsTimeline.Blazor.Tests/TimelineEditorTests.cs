// dotnet/JsTimeline.Blazor.Tests/TimelineEditorTests.cs
using Bunit;
using JsTimeline.Blazor.Editor;
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Stage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

public sealed class TimelineEditorTests : BunitContext
{
    private readonly BunitJSModuleInterop _module;
    private readonly BunitJSInterop _editor;
    public TimelineEditorTests()
    {
        _module = JSInterop.SetupModule("./_content/JsTimeline.Blazor/Editor/TimelineEditor.razor.js");
        _editor = _module.SetupModule(invocation => invocation.Identifier == "createTimelineEditor");
        _editor.Mode = JSRuntimeMode.Loose;
    }
    private static TimelineDocument Document(int frames = 24) => new() { Version = "2.0.0", Settings = new TimelineSettings { Fps = 24, TotalFrames = frames }, Layers = [] };

    [Fact]
    public void Creates_editor_with_the_bound_document()
    {
        var document = Document();
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, document));
        Assert.True(cut.Instance.IsReady);
        var args = Assert.Single(_module.Invocations["createTimelineEditor"]).Arguments;
        Assert.Equal(TimelineJson.Serialize(document), args[1]);
        Assert.Equal("html", args[2]);
    }

    [Fact]
    public async Task Binding_an_editor_change_does_not_reload_it()
    {
        TimelineDocument? changed = null;
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.DataChanged, (TimelineDocument value) => changed = value));
        await cut.Instance.DocumentChanged(TimelineJson.Serialize(Document(48)), 1);
        Assert.NotNull(changed);
        cut.Render(p => p.Add(x => x.Data, changed));
        Assert.Empty(_editor.Invocations["load"]);
    }

    [Fact]
    public void New_parent_document_is_loaded()
    {
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()));
        var next = Document(48);
        cut.Render(p => p.Add(x => x.Data, next));
        cut.WaitForAssertion(() => Assert.Equal(TimelineJson.Serialize(next), Assert.Single(_editor.Invocations["load"]).Arguments[0]));
    }

    [Fact]
    public async Task Import_and_undo_are_forwarded_to_the_editor()
    {
        _editor.Setup<bool>("importDocument", _ => true).SetResult(true);
        _editor.Setup<bool>("undo").SetResult(true);
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.Stage, TimelineStageOption.None()));
        Assert.Equal("none", Assert.Single(_module.Invocations["createTimelineEditor"]).Arguments[2]);
        Assert.True(await cut.Instance.ImportAsync("{}"));
        Assert.True(await cut.Instance.UndoAsync());
        Assert.Equal("{}", Assert.Single(_editor.Invocations["importDocument"]).Arguments[0]);
    }

    [Fact]
    public async Task Dispose_destroys_once()
    {
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()));
        await cut.Instance.DisposeAsync();
        await cut.Instance.DisposeAsync();
        _editor.VerifyInvoke("destroy", calledTimes: 1);
        await Assert.ThrowsAsync<InvalidOperationException>(() => cut.Instance.ExportAsync());
    }
    [Fact]
    public void Changing_stage_recreates_editor_with_the_new_choice()
    {
        var document = Document();
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, document));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.JsModule("./scene.js")));
        _editor.VerifyInvoke("destroy", calledTimes: 1);
        var calls = _module.Invocations["createTimelineEditor"];
        Assert.Equal(2, calls.Count);
        Assert.Equal("module", calls[1].Arguments[2]);
        Assert.Equal("./scene.js", calls[1].Arguments[3]);
    }

    [Fact]
    public void A_refused_parent_document_is_not_resent_on_render()
    {
        _editor.SetupVoid("load", _ => true).SetException(new Microsoft.JSInterop.JSException("invalid"));
        var errors = 0;
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.OnError, (Exception _) => errors++));
        var invalid = Document(48);
        cut.Render(p => p.Add(x => x.Data, invalid));
        cut.Render(p => p.Add(x => x.Data, invalid));
        Assert.Equal(1, errors);
        _editor.VerifyInvoke("load", calledTimes: 1);
    }    [Fact]
    public async Task Dotnet_stage_is_released_after_the_editor()
    {
        var stageModule = JSInterop.SetupModule("./_content/JsTimeline.Blazor/stage/dotnetStage.js");
        var jsStage = stageModule.SetupModule(invocation => invocation.Identifier == "createDotNetStage");
        jsStage.Mode = JSRuntimeMode.Loose;
        var stage = new TimelineStageTests.RecordingStage();
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.Stage, TimelineStageOption.DotNet(stage)));
        var call = Assert.Single(_module.Invocations["createTimelineEditor"]);
        Assert.Equal("dotnet", call.Arguments[2]);
        Assert.NotNull(call.Arguments[4]);
        await cut.Instance.DisposeAsync();
        _editor.VerifyInvoke("destroy", calledTimes: 1);
        jsStage.VerifyInvoke("stop", calledTimes: 1);
    }    [Fact]
    public async Task Disposal_during_module_import_releases_the_module()
    {
        var js = new FakeJsRuntime(resolveImport: false);
        Services.AddSingleton<IJSRuntime>(js);
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()));
        await cut.InvokeAsync(() => cut.Instance.DisposeAsync().AsTask());
        await cut.InvokeAsync(() => js.Import.SetResult(js.Module));
        await cut.InvokeAsync(() => { });
        Assert.True(js.Module.Disposed);
        Assert.False(cut.Instance.IsReady);
    }    [Fact]
    public async Task An_old_editor_notification_cannot_replace_a_new_parent_document()
    {
        var count = 0;
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.DataChanged, (TimelineDocument _) => count++));
        cut.Render(p => p.Add(x => x.Data, Document(48)));
        await cut.Instance.DocumentChanged(TimelineJson.Serialize(Document(30)), 1);
        Assert.Equal(0, count);
    }    [Fact]
    public async Task Error_handler_can_apply_a_new_document_without_waiting_on_itself()
    {
        var first = true;
        _editor.SetupVoid("load", _ => true).SetException(new JSException("invalid"));
        IRenderedComponent<TimelineEditor>? cut = null;
        var handled = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document()).Add(x => x.OnError, async (Exception _) =>
        {
            if (first)
            {
                first = false;
                await cut!.InvokeAsync(() => cut!.Render(p => p.Add(x => x.Data, Document(72))));
            }
            handled.TrySetResult();
        }));
        cut.Render(p => p.Add(x => x.Data, Document(48)));
        await handled.Task.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(2, _editor.Invocations["load"].Count);
    }    [Fact]
    public async Task Old_frame_and_stage_errors_are_ignored_after_stage_change()
    {
        var frames = 0;
        var errors = 0;
        var cut = Render<TimelineEditor>(p => p.Add(x => x.Data, Document())
            .Add(x => x.OnFrame, (int _) => frames++)
            .Add(x => x.OnError, (Exception _) => errors++));
        cut.Render(p => p.Add(x => x.Stage, TimelineStageOption.None()));
        await cut.Instance.FrameChanged(12, 1);
        await cut.Instance.StageError("old stage", 1);
        Assert.Equal(0, frames);
        Assert.Equal(0, errors);
    }}









