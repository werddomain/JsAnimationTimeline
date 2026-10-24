// dotnet/JsTimeline.Blazor/Player/TimelinePlayerInterop.cs
using JsTimeline.Blazor.Model;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace JsTimeline.Blazor.Player;

/// <summary>Options handed to <c>createTimelinePlayer</c> (serialized in camelCase by the JS runtime).</summary>
internal sealed record TimelinePlayerJsOptions(bool Autoplay, bool Loop, double Speed, bool NotifyFrames);

/// <summary>Receives the events of the JavaScript player and hands them to the component.</summary>
internal sealed class TimelinePlayerEventSink
{
    private readonly Func<string, int, Task> _onEvent;

    public TimelinePlayerEventSink(Func<string, int, Task> onEvent) => _onEvent = onEvent;

    /// <summary>Called by TimelinePlayer.razor.js for play, pause, complete, loop and frame.</summary>
    [JSInvokable]
    public Task OnPlayerEvent(string name, int frame) => _onEvent(name, frame);
}

/// <summary>Typed calls to TimelinePlayer.razor.js and to the player object it creates.</summary>
internal sealed class TimelinePlayerInterop : IAsyncDisposable
{
    /// <summary>Path of the collocated module, relative to the app base.</summary>
    public const string ModulePath = "./_content/JsTimeline.Blazor/Player/TimelinePlayer.razor.js";

    private readonly IJSObjectReference _module;
    private readonly IJSObjectReference _player;

    private TimelinePlayerInterop(IJSObjectReference module, IJSObjectReference player)
    {
        _module = module;
        _player = player;
    }

    public static async Task<TimelinePlayerInterop> CreateAsync(
        IJSRuntime js,
        ElementReference root,
        TimelineDocument document,
        TimelinePlayerJsOptions options,
        DotNetObjectReference<TimelinePlayerEventSink> events)
    {
        var module = await js.InvokeAsync<IJSObjectReference>("import", ModulePath);
        try
        {
            var player = await module.InvokeAsync<IJSObjectReference>(
                "createTimelinePlayer", root, TimelineJson.Serialize(document), options, events);
            return new TimelinePlayerInterop(module, player);
        }
        catch
        {
            await module.DisposeAsync();
            throw;
        }
    }

    public ValueTask PlayAsync() => _player.InvokeVoidAsync("play");

    public ValueTask PauseAsync() => _player.InvokeVoidAsync("pause");

    public ValueTask SeekAsync(int frame) => _player.InvokeVoidAsync("seek", frame);

    public ValueTask UpdateAsync(TimelineDocument document) =>
        _player.InvokeVoidAsync("update", TimelineJson.Serialize(document));

    public ValueTask SetLoopAsync(bool loop) => _player.InvokeVoidAsync("setLoop", loop);

    public ValueTask SetSpeedAsync(double speed) => _player.InvokeVoidAsync("setSpeed", speed);

    public ValueTask<TimelinePlayerState> GetStateAsync() => _player.InvokeAsync<TimelinePlayerState>("getState");

    /// <summary>Destroys the player (the elements get their own styles back), then releases the JS objects.</summary>
    public async ValueTask DisposeAsync()
    {
        // Each step runs even when the previous one failed, so no reference is left behind.
        await QuietlyAsync(() => _player.InvokeVoidAsync("destroy"));
        await QuietlyAsync(_player.DisposeAsync);
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
            // Teardown: the circuit or the page may already be gone, and the player with it.
        }
    }
}
