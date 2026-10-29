// dotnet/JsTimeline.Blazor.Tests/SampleEditorTests.cs
using Bunit;
using BlazorSample.Components;
using BlazorSample.Components.Pages;
using JsTimeline.Blazor.Editor;
using JsTimeline.Blazor.Model;

namespace JsTimeline.Blazor.Tests;

public sealed class SampleEditorTests : BunitContext
{
    [Fact]
    public async Task Import_and_undo_use_editor_commands_and_update_the_bound_duration()
    {
        var module = JSInterop.SetupModule("./_content/JsTimeline.Blazor/Editor/TimelineEditor.razor.js");
        var editor = module.SetupModule(call => call.Identifier == "createTimelineEditor");
        editor.Mode = JSRuntimeMode.Loose;
        editor.Setup<bool>("importDocument", _ => true).SetResult(true);
        editor.Setup<bool>("undo").SetResult(true);
        var page = Render<EditorPage>();
        var timeline = page.FindComponent<TimelineEditor>();
        Assert.Contains("Durée : 24 images", page.Markup);
        await page.FindAll("button").Single(button => button.TextContent.Contains("Importer un exemple")).ClickAsync(new());
        Assert.Equal(TimelineJson.Serialize(SampleDocuments.Html(48)), Assert.Single(editor.Invocations["importDocument"]).Arguments[0]);
        await timeline.Instance.DocumentChanged(TimelineJson.Serialize(SampleDocuments.Html(48)), 1);
        page.WaitForAssertion(() => Assert.Contains("Durée : 48 images", page.Markup));
        await page.FindAll("button").Single(button => button.TextContent.Contains("Annuler")).ClickAsync(new());
        editor.VerifyInvoke("undo", calledTimes: 1);
        await timeline.Instance.DocumentChanged(TimelineJson.Serialize(SampleDocuments.Html()), 1);
        page.WaitForAssertion(() => Assert.Contains("Durée : 24 images", page.Markup));
        await DisposeComponentsAsync();
        editor.VerifyInvoke("destroy", calledTimes: 1);
    }
}
