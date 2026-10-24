// dotnet/JsTimeline.Blazor/Stage/DotNetStageHandle.cs
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Stage;

/// <summary>
/// A C# stage plugged into the browser: <see cref="JsStage"/> is the runtime <c>IStage</c> built by
/// dotnetStage.js, ready for <c>createEditor({ stage })</c> or <c>createPlayer({ stage })</c>.
/// Disposing it stops the frames first (the script sends nothing more), then cancels a running
/// render and releases the JavaScript objects. A render already running may still finish after
/// <see cref="DisposeAsync"/> returns; it receives a cancelled token.
/// </summary>
internal sealed class DotNetStageHandle : IAsyncDisposable
{
    /// <summary>Path of the bridge module, relative to the app base.</summary>
    public const string ModulePath = "./_content/JsTimeline.Blazor/stage/dotnetStage.js";

    /// <summary>Longest wait, on dispose, for the last frame and for a running render.</summary>
    internal static readonly TimeSpan DisposeTimeout = TimeSpan.FromSeconds(2);

    private readonly IJSObjectReference _module;
    private readonly DotNetObjectReference<DotNetStageBridge> _receiver;
    private int _disposed;

    private DotNetStageHandle(IJSObjectReference module, IJSObjectReference jsStage, DotNetObjectReference<DotNetStageBridge> receiver)
    {
        _module = module;
        JsStage = jsStage;
        _receiver = receiver;
    }

    /// <summary>The runtime stage, to hand to the editor or player script.</summary>
    public IJSObjectReference JsStage { get; }

    /// <summary>
    /// Checks the stage, then builds its JavaScript side. <paramref name="cancellationToken"/> is checked
    /// between the two script calls only: a call that already started runs to its end, so nothing it
    /// created in the browser is left without an owner.
    /// </summary>
    /// <exception cref="ArgumentException">The stage is invalid (id, refs, property names...).</exception>
    public static async Task<DotNetStageHandle> CreateAsync(
        IJSRuntime js,
        ITimelineStage stage,
        FrameCallbackMode mode,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(js);
        var description = DotNetStageDescription.From(stage, mode);
        cancellationToken.ThrowIfCancellationRequested();
        var receiver = DotNetObjectReference.Create(new DotNetStageBridge(stage));
        IJSObjectReference? module = null;
        try
        {
            module = await js.InvokeAsync<IJSObjectReference>("import", ModulePath);
            cancellationToken.ThrowIfCancellationRequested();
            var jsStage = await module.InvokeAsync<IJSObjectReference>("createDotNetStage", description, receiver);
            return new DotNetStageHandle(module, jsStage, receiver);
        }
        catch
        {
            try
            {
                receiver.Value.Dispose();
                receiver.Dispose();
            }
            finally
            {
                if (module is not null)
                {
                    await QuietlyAsync(module.DisposeAsync);
                }
            }
            throw;
        }
    }

    /// <summary>
    /// Stops the frames (after the editor or player detached the stage, its last frame is delivered
    /// first), cancels a running render and waits for it, then releases the JavaScript objects. Both
    /// waits are bounded by <see cref="DisposeTimeout"/>. Dispose the handle after destroying the
    /// editor or player that uses the stage: disposed first, the final releases are not sent.
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) == 1)
        {
            return;
        }
        // Stop the script first, so no frame reaches a released receiver.
        using (var stopWait = new CancellationTokenSource(DisposeTimeout))
        {
            await QuietlyAsync(() => JsStage.InvokeVoidAsync("stop", stopWait.Token));
        }
        var bridge = _receiver.Value;
        try
        {
            bridge.Dispose();
            await bridge.WaitIdleAsync(DisposeTimeout);
            _receiver.Dispose();
        }
        finally
        {
            await QuietlyAsync(JsStage.DisposeAsync);
            await QuietlyAsync(_module.DisposeAsync);
        }
    }

    private static async Task QuietlyAsync(Func<ValueTask> step)
    {
        try
        {
            await step();
        }
        catch (Exception error) when (error is JSDisconnectedException or JSException or OperationCanceledException)
        {
            // Teardown: the circuit or the page may already be gone.
        }
    }
}
