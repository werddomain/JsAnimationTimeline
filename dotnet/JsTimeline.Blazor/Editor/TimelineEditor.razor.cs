// dotnet/JsTimeline.Blazor/Editor/TimelineEditor.razor.cs
using JsTimeline.Blazor.Model;
using JsTimeline.Blazor.Stage;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Editor;

/// <summary>Edits a timeline document in the browser.</summary>
public sealed partial class TimelineEditor : ComponentBase, IAsyncDisposable
{
    private const string ModulePath = "./_content/JsTimeline.Blazor/Editor/TimelineEditor.razor.js";
    private ElementReference _root;
    private IJSObjectReference? _module;
    private IJSObjectReference? _editor;
    private DotNetStageHandle? _stageHandle;
    private DotNetObjectReference<TimelineEditor>? _receiver;
    private TimelineDocument? _appliedData;
    private TimelineDocument? _requestedData;
    private TimelineStageOption? _appliedStage;
    private TimelineStageOption? _requestedStage;
    private TimelineDocument? _refusedData;
    private TimelineStageOption? _refusedStage;
    private Task _applying = Task.CompletedTask;
    private long _revision;
    private bool _disposed;
    private bool _creating;
    private Task? _releaseTask;

    [Inject] private IJSRuntime JS { get; set; } = default!;
    /// <summary>Document to edit; changes are reported through DataChanged.</summary>
    [Parameter, EditorRequired] public TimelineDocument Data { get; set; } = default!;
    /// <summary>Receives each document changed by an editor command.</summary>
    [Parameter] public EventCallback<TimelineDocument> DataChanged { get; set; }
    /// <summary>Receives displayed frame changes.</summary>
    [Parameter] public EventCallback<int> OnFrame { get; set; }
    /// <summary>Raised after the editor has been created.</summary>
    [Parameter] public EventCallback OnReady { get; set; }
    /// <summary>Receives creation and stage errors.</summary>
    [Parameter] public EventCallback<Exception> OnError { get; set; }
    /// <summary>Stage to animate; HTML is the default.</summary>
    [Parameter] public TimelineStageOption Stage { get; set; } = TimelineStageOption.Html();
    /// <summary>Content rendered inside the container.</summary>
    [Parameter] public RenderFragment? ChildContent { get; set; }
    /// <summary>Attributes applied to the container.</summary>
    [Parameter(CaptureUnmatchedValues = true)] public IReadOnlyDictionary<string, object>? AdditionalAttributes { get; set; }
    /// <summary>True once the JavaScript editor is ready.</summary>
    public bool IsReady => _editor is not null;

    /// <inheritdoc />
    protected override async Task OnParametersSetAsync()
    {
        if (Data is null) throw new InvalidOperationException("TimelineEditor needs a Data document.");
        if (Stage is null) throw new InvalidOperationException("TimelineEditor needs a Stage option.");
        if (_editor is null || _disposed) return;
        if (!ReferenceEquals(Data, _requestedData) || Stage != _requestedStage)
        {
            _requestedData = Data; _requestedStage = Stage; _revision++;
        }
        var previous = _applying;
        var current = ApplyAfterAsync(previous);
        _applying = current;
        var error = await current;
        if (error is not null) await ReportAsync(error);
    }

    private async Task<Exception?> ApplyAfterAsync(Task previous)
    {
        await previous;
        if (_editor is null || _disposed) return null;
        if (Stage != _appliedStage)
        {
            var data = Data;
            var stage = Stage;
            try { await ReleaseAsync(); }
            catch (Exception error) { _refusedData = data; _refusedStage = stage; return error; }
            return null;
        }
        if (!ReferenceEquals(Data, _appliedData) && !ReferenceEquals(Data, _refusedData))
        {
            var data = Data;
            var revision = _revision;
            string json;
            try { json = TimelineJson.Serialize(data); }
            catch (Exception error)
            {
                _refusedData = data;
                try { await _editor.InvokeVoidAsync("setRevision", revision); }
                catch (Exception syncError) { return new AggregateException(error, syncError); }
                return error;
            }
            try
            {
                await _editor.InvokeVoidAsync("load", json, revision);
                _appliedData = data;
                _refusedData = null;
            }
            catch (Exception error) { _refusedData = data; return error; }
        }
        return null;
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (_editor is not null || _creating || _releaseTask is not null || _disposed || (ReferenceEquals(Data, _refusedData) && Stage == _refusedStage)) return;
        _creating = true;
        var data = Data;
        var stage = Stage;
        try
        {
            _revision++;
            _receiver ??= DotNetObjectReference.Create(this);
            var module = await JS.InvokeAsync<IJSObjectReference>("import", ModulePath);
            _module = module;
            if (_disposed) return;
            if (stage is DotNetStageOption dotNet)
                _stageHandle = await DotNetStageHandle.CreateAsync(JS, dotNet.Stage, dotNet.Mode);
            if (_disposed) return;
            var kind = stage switch { NoStageOption => "none", JsModuleStageOption => "module", DotNetStageOption => "dotnet", _ => "html" };
            var path = (stage as JsModuleStageOption)?.ModulePath;
            _editor = await module.InvokeAsync<IJSObjectReference>("createTimelineEditor", _root, TimelineJson.Serialize(data), kind, path, _stageHandle?.JsStage, _receiver, _revision);
            if (_disposed) return;
            _appliedData = data;
            _requestedData = data;
            _appliedStage = stage;
            _requestedStage = stage;
            await OnReady.InvokeAsync();
            await OnParametersSetAsync();
        }
        catch (Exception error) when (error is JSDisconnectedException || (_disposed && error is OperationCanceledException)) { }
        catch (Exception error)
        {
            _refusedData = data; _refusedStage = stage;
            try { await ReleaseAsync(); }
            catch (Exception cleanup) { error = new AggregateException(error, cleanup); }
            await ReportAsync(error);
        }
        finally
        {
            _creating = false;
            if (_disposed) { try { await ReleaseAsync(); } catch (Exception error) when (error is JSDisconnectedException or JSException or OperationCanceledException) { } finally { _receiver?.Dispose(); } }
            else if (_editor is null && (!ReferenceEquals(Data, _refusedData) || Stage != _refusedStage)) StateHasChanged();
        }
    }

    /// <summary>Receives a document from JavaScript.</summary>
    [JSInvokable] public Task DocumentChanged(string json, long revision) => InvokeAsync(async () =>
    {
        if (_disposed || revision != _revision) return;
        try
        {
            var data = TimelineJson.Deserialize(json);
            _appliedData = data;
            _requestedData = data;
            await DataChanged.InvokeAsync(data);
        }
        catch (Exception error) { await ReportAsync(error); }
    });

    /// <summary>Receives a frame from JavaScript.</summary>
    [JSInvokable] public Task FrameChanged(int frame, long revision) => InvokeAsync(() => _disposed || revision != _revision ? Task.CompletedTask : OnFrame.InvokeAsync(frame));
    /// <summary>Receives a stage error from JavaScript.</summary>
    [JSInvokable] public Task StageError(string message, long revision) => InvokeAsync(() => _disposed || revision != _revision ? Task.CompletedTask : ReportAsync(new JSException(message)));
    /// <summary>Imports JSON as an undoable command; returns false when refused.</summary>
    public async Task<bool> ImportAsync(string json) => await RequireEditor().InvokeAsync<bool>("importDocument", json);
    /// <summary>Exports the current document as JSON.</summary>
    public async Task<string> ExportAsync() => await RequireEditor().InvokeAsync<string>("exportJson");
    /// <summary>Undoes the latest command.</summary>
    public async Task<bool> UndoAsync() => await RequireEditor().InvokeAsync<bool>("undo");
    /// <summary>Redoes the latest undone command.</summary>
    public async Task<bool> RedoAsync() => await RequireEditor().InvokeAsync<bool>("redo");
    /// <summary>Finds targets again after the scene changes.</summary>
    public async Task RefreshTargetsAsync(string? layerId = null) => await RequireEditor().InvokeVoidAsync("refreshTargets", layerId);
    private IJSObjectReference RequireEditor() => _editor ?? throw new InvalidOperationException(_disposed ? "TimelineEditor was disposed." : "TimelineEditor is not ready.");
    private async Task ReportAsync(Exception error)
    {
        if (_disposed) return;
        if (OnError.HasDelegate) await OnError.InvokeAsync(error);
        else if (error is AggregateException) throw new InvalidOperationException("TimelineEditor encountered multiple errors.", error);
        else throw error;
    }
    private async Task ReleaseAsync()
    {
        if (_releaseTask is { } release) { await release; return; }
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _releaseTask = completion.Task;
        try { await ReleaseCoreAsync(); }
        finally { _releaseTask = null; completion.TrySetResult(); }
    }
    private async Task ReleaseCoreAsync()
    {
        var editor = _editor; _editor = null;
        var stage = _stageHandle; _stageHandle = null;
        var module = _module; _module = null;
        try { if (editor is not null) { try { await editor.InvokeVoidAsync("destroy"); } finally { await editor.DisposeAsync(); } } }
        finally { try { if (stage is not null) await stage.DisposeAsync(); } finally { if (module is not null) await module.DisposeAsync(); } }
    }
    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        if (!_creating) { try { await ReleaseAsync(); } catch (Exception error) when (error is JSDisconnectedException or JSException or OperationCanceledException) { } finally { _receiver?.Dispose(); } }
    }
}
