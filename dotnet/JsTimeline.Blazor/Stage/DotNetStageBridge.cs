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
        try
        {
            await _stage.RenderAsync(frame, _lifetime.Token);
        }
        catch (OperationCanceledException) when (IsDisposed)
        {
            // Cancelled because the stage was released: an expected end, not a stage error.
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
