// dotnet/JsTimeline.Blazor/Stage/DotNetStageBridge.cs
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Stage;

/// <summary>
/// Receiver of dotnetStage.js: forwards each frame to the <see cref="ITimelineStage"/>. The script
/// sends one frame at a time, so calls never overlap.
/// </summary>
internal sealed class DotNetStageBridge : IDisposable
{
    private readonly ITimelineStage _stage;
    // Never disposed: a CancellationTokenSource without a timer holds no unmanaged resource, and a
    // render running on another thread may still read its token after Dispose.
    private readonly CancellationTokenSource _lifetime = new();
    private int _disposed;
    // The render running now, or a completed task.
    private Task _running = Task.CompletedTask;

    public DotNetStageBridge(ITimelineStage stage) => _stage = stage ?? throw new ArgumentNullException(nameof(stage));

    private bool IsDisposed => Volatile.Read(ref _disposed) == 1;

    /// <summary>Called by dotnetStage.js; a thrown exception rejects the call and reaches the stage context.</summary>
    [JSInvokable]
    public async Task RenderAsync(TimelineStageFrame frame)
    {
        ArgumentNullException.ThrowIfNull(frame);
        if (IsDisposed)
        {
            return;
        }
        // Published before the call: a dispose racing with it still waits for this render.
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Volatile.Write(ref _running, done.Task);
        try
        {
            await _stage.RenderAsync(frame, _lifetime.Token);
        }
        catch (OperationCanceledException) when (IsDisposed)
        {
            // Cancelled because the stage was released: an expected end, not a stage error.
        }
        finally
        {
            done.TrySetResult();
        }
    }

    /// <summary>
    /// Waits, at most <paramref name="timeout"/>, for the render running now to end (whatever its
    /// outcome), so a new bridge for the same stage does not overlap it.
    /// </summary>
    public async Task WaitIdleAsync(TimeSpan timeout)
    {
        var running = Volatile.Read(ref _running);
        try
        {
            await running.WaitAsync(timeout);
        }
        catch (Exception)
        {
            // Its outcome was reported to the script already, or it outlived the wait: stop waiting.
        }
    }

    /// <summary>Cancels a running render; later frames are ignored.</summary>
    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) == 1)
        {
            return;
        }
        try
        {
            _lifetime.Cancel();
        }
        catch (AggregateException)
        {
            // A callback registered on the token threw: the bridge is released anyway.
        }
    }
}
