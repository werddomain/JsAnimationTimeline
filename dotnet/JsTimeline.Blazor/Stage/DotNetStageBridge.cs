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
    private readonly CancellationTokenSource _lifetime = new();
    private bool _disposed;

    public DotNetStageBridge(ITimelineStage stage) => _stage = stage ?? throw new ArgumentNullException(nameof(stage));

    /// <summary>Called by dotnetStage.js; a thrown exception rejects the call and reaches the stage context.</summary>
    [JSInvokable]
    public Task RenderAsync(TimelineStageFrame frame)
    {
        ArgumentNullException.ThrowIfNull(frame);
        return _disposed ? Task.CompletedTask : _stage.RenderAsync(frame, _lifetime.Token);
    }

    /// <summary>Cancels a running render; later frames are ignored.</summary>
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        _lifetime.Cancel();
        _lifetime.Dispose();
    }
}
