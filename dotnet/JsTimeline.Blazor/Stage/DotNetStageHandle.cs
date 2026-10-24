// dotnet/JsTimeline.Blazor/Stage/DotNetStageHandle.cs
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Stage;

/// <summary>
/// A C# stage plugged into the browser: <see cref="JsStage"/> is the runtime <c>IStage</c> built by
/// dotnetStage.js, ready for <c>createEditor({ stage })</c> or <c>createPlayer({ stage })</c>.
/// Disposing it releases the JavaScript objects and stops the frames.
/// </summary>
internal sealed class DotNetStageHandle : IAsyncDisposable
{
    /// <summary>Path of the bridge module, relative to the app base.</summary>
    public const string ModulePath = "./_content/JsTimeline.Blazor/stage/dotnetStage.js";

    private readonly IJSObjectReference _module;
    private readonly DotNetObjectReference<DotNetStageBridge> _receiver;
    private bool _disposed;

    private DotNetStageHandle(IJSObjectReference module, IJSObjectReference jsStage, DotNetObjectReference<DotNetStageBridge> receiver)
    {
        _module = module;
        JsStage = jsStage;
        _receiver = receiver;
    }

    /// <summary>The runtime stage, to hand to the editor or player script.</summary>
    public IJSObjectReference JsStage { get; }

    /// <summary>Checks the stage, then builds its JavaScript side.</summary>
    /// <exception cref="ArgumentException">The stage is invalid (id, refs, property names...).</exception>
    public static async Task<DotNetStageHandle> CreateAsync(
        IJSRuntime js,
        ITimelineStage stage,
        FrameCallbackMode mode,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(js);
        var description = DotNetStageDescription.From(stage, mode);
        var receiver = DotNetObjectReference.Create(new DotNetStageBridge(stage));
        IJSObjectReference? module = null;
        try
        {
            module = await js.InvokeAsync<IJSObjectReference>("import", cancellationToken, ModulePath);
            var jsStage = await module.InvokeAsync<IJSObjectReference>("createDotNetStage", cancellationToken, description, receiver);
            return new DotNetStageHandle(module, jsStage, receiver);
        }
        catch
        {
            receiver.Value.Dispose();
            receiver.Dispose();
            if (module is not null)
            {
                await QuietlyAsync(module.DisposeAsync);
            }
            throw;
        }
    }

    /// <summary>Stops the frames, then releases the JavaScript objects (the editor or player detaches the stage itself).</summary>
    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        _receiver.Value.Dispose();
        _receiver.Dispose();
        await QuietlyAsync(JsStage.DisposeAsync);
        await QuietlyAsync(_module.DisposeAsync);
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
