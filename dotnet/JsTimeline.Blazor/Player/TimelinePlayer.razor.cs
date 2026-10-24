// dotnet/JsTimeline.Blazor/Player/TimelinePlayer.razor.cs
using System.Runtime.ExceptionServices;
using JsTimeline.Blazor.Model;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Player;

/// <summary>
/// Plays a timeline document on the HTML content of the component: the layer selectors are resolved
/// inside the element it renders around <see cref="ChildContent"/>. Built on <c>createPlayer</c> of the
/// timeline-runtime package (Web Animations), so playback runs in the browser without .NET round trips.
/// </summary>
public sealed partial class TimelinePlayer : ComponentBase, IAsyncDisposable
{
    private ElementReference _root;
    private TimelinePlayerInterop? _interop;
    private DotNetObjectReference<TimelinePlayerEventSink>? _events;
    private TimelineDocument? _appliedData;
    private TimelineDocument? _refusedData;
    private bool _appliedLoop;
    private double _appliedSpeed;
    private bool _creating;
    private bool _disposed;
    private Task _applying = Task.CompletedTask;
    private bool _applyPending;

    [Inject]
    private IJSRuntime JS { get; set; } = default!;

    /// <summary>
    /// Document to play. A new instance replaces the animation and keeps the time and play state; a
    /// document changed in place is not seen. After a refused document, a new instance is tried again.
    /// </summary>
    [Parameter, EditorRequired]
    public TimelineDocument Data { get; set; } = default!;

    /// <summary>HTML animated by the document. Selectors are resolved when the document is applied.</summary>
    [Parameter]
    public RenderFragment? ChildContent { get; set; }

    /// <summary>Starts playing as soon as the player is created.</summary>
    [Parameter]
    public bool Autoplay { get; set; }

    /// <summary>Restarts at frame 1 after the last frame.</summary>
    [Parameter]
    public bool Loop { get; set; }

    /// <summary>Playback rate, finite and greater than 0. Defaults to 1.</summary>
    [Parameter]
    public double Speed { get; set; } = 1;

    /// <summary>
    /// The displayed frame changed. Set it on the first render: frames are only sent to .NET when a
    /// handler exists when the player is created, to spare a round trip per frame otherwise.
    /// </summary>
    [Parameter]
    public EventCallback<int> OnFrame { get; set; }

    /// <summary>Playback started.</summary>
    [Parameter]
    public EventCallback OnPlay { get; set; }

    /// <summary>Playback paused.</summary>
    [Parameter]
    public EventCallback OnPause { get; set; }

    /// <summary>The last frame was reached without <see cref="Loop"/>; playback stopped.</summary>
    [Parameter]
    public EventCallback OnComplete { get; set; }

    /// <summary>The last frame was reached with <see cref="Loop"/>; playback restarted at frame 1.</summary>
    [Parameter]
    public EventCallback OnLoop { get; set; }

    /// <summary>The JavaScript player exists: the methods of the component can be called.</summary>
    [Parameter]
    public EventCallback OnReady { get; set; }

    /// <summary>
    /// An error of the JavaScript player:
    /// <list type="bullet">
    /// <item>a <see cref="JSException"/> when it refuses a document (invalid document, or the stage
    /// refuses it); the refused instance is not sent again, a new instance is;</item>
    /// <item>a <see cref="TimelineStageException"/> when the stage throws while playing (playback goes on);</item>
    /// <item>a <see cref="System.Text.Json.JsonException"/> when a document cannot be written as JSON
    /// (for example a <see cref="LayerTarget"/> with two forms).</item>
    /// </list>
    /// A selector that matches nothing is not an error: see <see cref="TimelinePlayerState.MissingTargets"/>.
    /// Without a handler, a refused document is thrown to the renderer and a stage error goes to the
    /// browser console. The refused instance is recognised by reference: a parent that builds a new
    /// document on every render sends it again after each OnError re-render.
    /// </summary>
    [Parameter]
    public EventCallback<Exception> OnError { get; set; }

    /// <summary>Attributes of the element rendered around <see cref="ChildContent"/> (class, style...).</summary>
    [Parameter(CaptureUnmatchedValues = true)]
    public IReadOnlyDictionary<string, object>? AdditionalAttributes { get; set; }

    /// <summary>Last frame reported by the player (1 before the first report).</summary>
    public int CurrentFrame { get; private set; } = 1;

    /// <summary>Playback is running, as last reported by the player.</summary>
    public bool IsPlaying { get; private set; }

    /// <summary>The JavaScript player exists.</summary>
    public bool IsReady => _interop is not null;

    /// <summary>Starts or resumes playback.</summary>
    public Task PlayAsync() => RequireInterop().PlayAsync().AsTask();

    /// <summary>Pauses playback.</summary>
    public Task PauseAsync() => RequireInterop().PauseAsync().AsTask();

    /// <summary>Goes to a frame (the player clamps it to the last frame), playing or not.</summary>
    public Task SeekAsync(int frame)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(frame, 1);
        return RequireInterop().SeekAsync(frame).AsTask();
    }

    /// <summary>Reads the current state of the JavaScript player.</summary>
    public Task<TimelinePlayerState> GetStateAsync() => RequireInterop().GetStateAsync().AsTask();

    /// <summary>
    /// Looks again for the layers without an element (all of them, or only <paramref name="layerId"/>).
    /// Targets are looked up when a document is applied: call it when the content renders an animated
    /// element later (an <c>@if</c> block, a child component loading data, a list).
    /// </summary>
    public Task RefreshTargetsAsync(string? layerId = null) => RequireInterop().RefreshTargetsAsync(layerId).AsTask();

    /// <inheritdoc />
    protected override Task OnParametersSetAsync()
    {
        if (Data is null)
        {
            throw new InvalidOperationException($"{nameof(TimelinePlayer)} needs a {nameof(Data)} document.");
        }
        if (!double.IsFinite(Speed) || Speed <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(Speed), Speed, "Speed must be a finite number greater than 0.");
        }
        return ApplyParametersAsync();
    }

    /// <inheritdoc />
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        // The first render creates the player; a later one retries after a refused document.
        if (_interop is not null || _creating || _disposed || ReferenceEquals(Data, _refusedData))
        {
            return;
        }
        _creating = true;
        try
        {
            await CreatePlayerAsync();
        }
        finally
        {
            _creating = false;
            if (_disposed)
            {
                // DisposeAsync ran during the creation and left the reference to this continuation.
                _events?.Dispose();
            }
        }
    }

    private async Task CreatePlayerAsync()
    {
        var (data, loop, speed) = (Data, Loop, Speed);
        _events ??= DotNetObjectReference.Create(new TimelinePlayerEventSink(HandlePlayerEventAsync, HandlePlayerErrorAsync));
        var options = new TimelinePlayerJsOptions(Autoplay, loop, speed, OnFrame.HasDelegate);
        TimelinePlayerInterop interop;
        try
        {
            interop = await TimelinePlayerInterop.CreateAsync(JS, _root, data, options, _events);
        }
        catch (Exception error) when (IsTeardown(error))
        {
            return; // The page or the component is going away: there is nothing left to play on.
        }
        catch (Exception error)
        {
            // Refused by the player (JSException) or not serializable (JsonException).
            _refusedData = data;
            await ReportAsync(error);
            return;
        }
        if (_disposed)
        {
            await interop.DisposeAsync();
            return;
        }
        (_appliedData, _appliedLoop, _appliedSpeed, _refusedData) = (data, loop, speed, null);
        _interop = interop;
        await OnReady.InvokeAsync();
        // Parameters may have changed while the player was being created.
        await ApplyParametersAsync();
    }

    /// <summary>
    /// Sends the changed parameters, one application at a time: OnReady and OnError re-render the
    /// parent, which sets the parameters again while an application may still be running. At most one
    /// application waits behind the running one; it reads the parameters when it starts, so the latest
    /// values win. Errors are reported after the application, outside the chain: a slow OnError
    /// handler never holds back the next parameters.
    /// </summary>
    private Task ApplyParametersAsync()
    {
        if (_interop is null)
        {
            return Task.CompletedTask;
        }
        if (_applyPending)
        {
            // The pending application reads these parameters when it starts; its errors go to the
            // caller that queued it.
            return Task.CompletedTask;
        }
        _applyPending = true;
        var application = ApplyAfterAsync(_applying);
        _applying = application;
        return ReportAfterAsync(application);
    }

    private async Task<IReadOnlyList<Exception>> ApplyAfterAsync(Task previous)
    {
        // Applications collect their errors instead of throwing, so the previous one never faults.
        await previous;
        _applyPending = false;
        var errors = new List<Exception>();
        // Loop and Speed are applied even when the document is refused.
        await ApplyDataAsync(errors);
        await ApplyPlaybackAsync(errors);
        return errors;
    }

    /// <summary>
    /// Hands every error of an application to <see cref="OnError"/>; what it cannot handle is thrown
    /// to the renderer once (see <see cref="ThrowUnhandled"/>).
    /// </summary>
    private async Task ReportAfterAsync(Task<IReadOnlyList<Exception>> application)
    {
        var errors = await application;
        var unhandled = new List<Exception>();
        foreach (var error in errors)
        {
            if (_disposed)
            {
                return; // Disposed while a handler ran: the remaining errors no longer matter.
            }
            if (await OfferToOnErrorAsync(error) is { } left)
            {
                unhandled.Add(left);
            }
        }
        if (!_disposed)
        {
            ThrowUnhandled(unhandled);
        }
    }

    /// <summary>
    /// Gives one error to <see cref="OnError"/>. Returns what is left to throw: null when it was
    /// handled (or the component is disposed), the error itself without a handler, or an
    /// <see cref="AggregateException"/> holding the handler's failure and the original error.
    /// </summary>
    private async Task<Exception?> OfferToOnErrorAsync(Exception error)
    {
        if (_disposed)
        {
            return null;
        }
        if (!OnError.HasDelegate)
        {
            return error;
        }
        try
        {
            await OnError.InvokeAsync(error);
            return null;
        }
        catch (Exception failure)
        {
            // Keep the original error with the failure of its handler.
            return new AggregateException(failure, error);
        }
    }

    /// <summary>
    /// Throws the errors nobody handled: a single plain error as it is; otherwise an
    /// InvalidOperationException whose inner AggregateException holds them all (a bare
    /// AggregateException would be cut to its first inner exception by the renderer).
    /// </summary>
    private static void ThrowUnhandled(IReadOnlyList<Exception> unhandled)
    {
        if (unhandled.Count == 0)
        {
            return;
        }
        if (unhandled is [var single] && single is not AggregateException)
        {
            ExceptionDispatchInfo.Capture(single).Throw();
        }
        var inner = unhandled is [AggregateException aggregate] ? aggregate : new AggregateException(unhandled);
        throw new InvalidOperationException(
            $"{nameof(TimelinePlayer)}: {inner.InnerExceptions.Count} unhandled errors, see the inner exceptions.",
            inner);
    }

    private async Task ApplyDataAsync(List<Exception> errors)
    {
        var (interop, data) = (_interop, Data);
        if (interop is null || ReferenceEquals(data, _appliedData) || ReferenceEquals(data, _refusedData))
        {
            return;
        }
        try
        {
            await interop.UpdateAsync(data);
            (_appliedData, _refusedData) = (data, null);
        }
        catch (Exception error) when (IsTeardown(error))
        {
            // Disposed or disconnected during the call: the player is gone with it.
        }
        catch (Exception error)
        {
            // Refused by the player (JSException) or not serializable: the player keeps the previous
            // document. Remember the refused instance so a re-render of the parent (OnError re-renders
            // it) does not send it again in a loop.
            _refusedData = data;
            errors.Add(error);
        }
    }

    private async Task ApplyPlaybackAsync(List<Exception> errors)
    {
        var (interop, loop, speed) = (_interop, Loop, Speed);
        if (interop is null)
        {
            return;
        }
        if (loop != _appliedLoop)
        {
            await ApplyStepAsync(() => interop.SetLoopAsync(loop), () => _appliedLoop = loop, errors);
        }
        if (speed != _appliedSpeed && !_disposed)
        {
            await ApplyStepAsync(() => interop.SetSpeedAsync(speed), () => _appliedSpeed = speed, errors);
        }
    }

    /// <summary>Runs one call to the player; a failure is collected and does not stop the next call.</summary>
    private async Task ApplyStepAsync(Func<ValueTask> call, Action applied, List<Exception> errors)
    {
        try
        {
            await call();
            applied();
        }
        catch (Exception error) when (IsTeardown(error))
        {
            // Disposed or disconnected during the call: the player is gone with it.
        }
        catch (Exception error)
        {
            errors.Add(error);
        }
    }

    /// <summary>
    /// A stage error while playing. Returns false when nobody handles it (no <see cref="OnError"/>
    /// handler now, even if there was one at creation): the script then logs it to the console.
    /// </summary>
    private async Task<bool> HandlePlayerErrorAsync(string message)
    {
        var handled = false;
        await InvokeAsync(async () =>
        {
            if (_disposed || !OnError.HasDelegate)
            {
                return;
            }
            handled = true;
            if (await OfferToOnErrorAsync(new TimelineStageException(message)) is { } failure && !_disposed)
            {
                // The handler threw: a component error (with the stage error inside), not something to
                // lose in JavaScript.
                await DispatchExceptionAsync(new InvalidOperationException(
                    $"{nameof(TimelinePlayer)}: {nameof(OnError)} threw while handling a stage error.", failure));
            }
        });
        return handled;
    }

    private Task HandlePlayerEventAsync(string name, int frame) => InvokeAsync(async () =>
    {
        if (_disposed)
        {
            return;
        }
        CurrentFrame = frame;
        try
        {
            await RaiseAsync(name, frame);
        }
        catch (Exception error)
        {
            // A handler failed: report it like any component error instead of losing it in JavaScript.
            await DispatchExceptionAsync(error);
        }
    });

    private Task RaiseAsync(string name, int frame)
    {
        switch (name)
        {
            case "play":
                IsPlaying = true;
                return OnPlay.InvokeAsync();
            case "pause":
                IsPlaying = false;
                return OnPause.InvokeAsync();
            case "complete":
                IsPlaying = false;
                return OnComplete.InvokeAsync();
            case "loop":
                return OnLoop.InvokeAsync();
            case "frame":
                return OnFrame.InvokeAsync(frame);
            default:
                return Task.CompletedTask; // An event of a newer script: nothing to do with it here.
        }
    }

    /// <summary>One error of the creation path, reported like the errors of an application.</summary>
    private async Task ReportAsync(Exception error)
    {
        if (await OfferToOnErrorAsync(error) is { } left && !_disposed)
        {
            ThrowUnhandled([left]);
        }
    }

    private bool IsTeardown(Exception error) =>
        error is JSDisconnectedException or OperationCanceledException
        || (_disposed && error is ObjectDisposedException);

    private TimelinePlayerInterop RequireInterop() =>
        _interop ?? throw new InvalidOperationException(
            _disposed
                ? $"The {nameof(TimelinePlayer)} was disposed."
                : $"The {nameof(TimelinePlayer)} is not ready yet: wait for {nameof(OnReady)}.");

    /// <summary>Destroys the JavaScript player: the elements get their own styles back.</summary>
    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        var interop = _interop;
        _interop = null;
        try
        {
            if (interop is not null)
            {
                await interop.DisposeAsync();
            }
        }
        finally
        {
            // A pending creation still uses the reference: it disposes it when it ends.
            if (!_creating)
            {
                _events?.Dispose();
            }
        }
    }
}
