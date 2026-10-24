// dotnet/JsTimeline.Blazor.Tests/FakeJs.cs
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Tests;

/// <summary>
/// Hand-written JS runtime for the lifecycle cases bUnit cannot script: a pending import, a module
/// whose <c>createTimelinePlayer</c> fails, or a player whose <c>destroy</c> fails.
/// </summary>
internal sealed class FakeJsRuntime : IJSRuntime
{
    public TaskCompletionSource<IJSObjectReference> Import { get; } = new();

    public FakeJsObject Module { get; } = new();

    public FakeJsObject Player { get; } = new();

    /// <summary>When set, <c>createTimelinePlayer</c> throws it instead of returning <see cref="Player"/>.</summary>
    public Exception? CreateError { get; set; }

    public FakeJsRuntime(bool resolveImport = true)
    {
        Module.Handler = (identifier, _) => identifier == "createTimelinePlayer"
            ? CreateError is null ? Player : throw CreateError
            : null;
        if (resolveImport)
        {
            Import.SetResult(Module);
        }
    }

    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
    {
        if (identifier != "import")
        {
            throw new InvalidOperationException($"Unexpected call {identifier}.");
        }
        // A resolved import completes synchronously, like bUnit's own interop.
        return Import.Task.IsCompletedSuccessfully
            ? new ValueTask<TValue>((TValue)Import.Task.Result)
            : new ValueTask<TValue>(AwaitImportAsync<TValue>());
    }

    private async Task<TValue> AwaitImportAsync<TValue>() => (TValue)await Import.Task;

    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args) =>
        InvokeAsync<TValue>(identifier, args);
}

/// <summary>A JS object that records its calls and answers through <see cref="Handler"/>.</summary>
internal sealed class FakeJsObject : IJSObjectReference
{
    public List<string> Calls { get; } = new();

    public Func<string, object?[]?, object?> Handler { get; set; } = (_, _) => null;

    public bool Disposed { get; private set; }

    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
    {
        Calls.Add(identifier);
        try
        {
            return new ValueTask<TValue>((TValue)Handler(identifier, args)!);
        }
        catch (Exception error)
        {
            return ValueTask.FromException<TValue>(error);
        }
    }

    public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args) =>
        InvokeAsync<TValue>(identifier, args);

    public ValueTask DisposeAsync()
    {
        Disposed = true;
        return ValueTask.CompletedTask;
    }
}
