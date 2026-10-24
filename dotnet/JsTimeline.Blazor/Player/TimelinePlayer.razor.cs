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
    /// The JavaScript player refused the document (invalid document or selector). Without a handler,
    /// the error is thrown to the renderer.
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
        _events ??= DotNetObjectReference.Create(new TimelinePlayerEventSink(HandlePlayerEventAsync));
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
        catch (JSException error)
        {
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

    private async Task ApplyParametersAsync()
    {
        var interop = _interop;
        if (interop is null)
        {
            return;
        }
        try
        {
            if (!ReferenceEquals(Data, _appliedData))
            {
                var data = Data;
                await interop.UpdateAsync(data);
                _appliedData = data;
            }
            if (Loop != _appliedLoop && !_disposed)
            {
                var loop = Loop;
                await interop.SetLoopAsync(loop);
                _appliedLoop = loop;
            }
            if (Speed != _appliedSpeed && !_disposed)
            {
                var speed = Speed;
                await interop.SetSpeedAsync(speed);
                _appliedSpeed = speed;
            }
        }
        catch (Exception error) when (IsTeardown(error))
        {
            // Disposed or disconnected during a call: the player is gone with it.
        }
        catch (JSException error)
        {
            await ReportAsync(error);
        }
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

    private async Task ReportAsync(Exception error)
    {
        if (_disposed)
        {
            return;
        }
        if (!OnError.HasDelegate)
        {
            ExceptionDispatchInfo.Capture(error).Throw();
        }
        await OnError.InvokeAsync(error);
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
