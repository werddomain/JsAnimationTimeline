// dotnet/JsTimeline.Blazor.Tests/LayerTargetTests.cs
using System.Text.Json;
using JsTimeline.Blazor.Model;

namespace JsTimeline.Blazor.Tests;

public sealed class LayerTargetTests
{
    [Theory]
    [InlineData("""{"selector":"#logo"}""")]
    [InlineData("""{"ref":"hero"}""")]
    [InlineData("""{"ref":"hero","stage":"canvas"}""")]
    public void Each_form_round_trips(string json)
    {
        var target = JsonSerializer.Deserialize<LayerTarget>(json)!;

        Assert.Equal(json, JsonSerializer.Serialize(target));
    }

    [Fact]
    public void Factories_write_only_the_keys_of_their_form()
    {
        Assert.Equal("""{"selector":"#logo"}""", JsonSerializer.Serialize(LayerTarget.FromSelector("#logo")));
        Assert.Equal("""{"ref":"hero"}""", JsonSerializer.Serialize(LayerTarget.FromRef("hero")));
        Assert.Equal("""{"ref":"hero","stage":"canvas"}""", JsonSerializer.Serialize(LayerTarget.FromRef("hero", "canvas")));
    }

    [Theory]
    [InlineData("two forms", """{"selector":"#logo","ref":"hero"}""")]
    [InlineData("no form", """{}""")]
    [InlineData("stage only", """{"stage":"canvas"}""")]
    [InlineData("stage with selector", """{"selector":"#logo","stage":"html"}""")]
    [InlineData("empty selector", """{"selector":""}""")]
    [InlineData("empty ref", """{"ref":""}""")]
    [InlineData("empty stage", """{"ref":"hero","stage":""}""")]
    [InlineData("unknown key", """{"ref":"hero","element":"x"}""")]
    public void Reading_a_target_that_breaks_the_rule_throws(string reason, string json)
    {
        var error = Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<LayerTarget>(json));
        Assert.False(string.IsNullOrEmpty(error.Message), reason);
    }

    [Fact]
    public void Writing_a_target_that_breaks_the_rule_throws()
    {
        var target = new LayerTarget { Selector = "#logo", Ref = "hero" };

        var error = Assert.Throws<JsonException>(() => JsonSerializer.Serialize(target));
        Assert.Contains("exactly one", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Factories_refuse_values_that_break_the_rule()
    {
        Assert.Throws<ArgumentException>(() => LayerTarget.FromSelector(""));
        Assert.Throws<ArgumentException>(() => LayerTarget.FromRef(""));
        Assert.Throws<ArgumentException>(() => LayerTarget.FromRef("hero", ""));
    }

    [Fact]
    public void Validation_error_names_the_offending_key()
    {
        Assert.Null(LayerTarget.FromRef("hero", "canvas").GetValidationError());
        Assert.Contains("\"stage\"", new LayerTarget { Selector = "#a", Stage = "html" }.GetValidationError(), StringComparison.Ordinal);
        Assert.Contains("exactly one", new LayerTarget().GetValidationError(), StringComparison.Ordinal);
    }

    [Fact]
    public void Targets_compare_by_value()
    {
        Assert.Equal(LayerTarget.FromRef("hero", "canvas"), LayerTarget.FromRef("hero", "canvas"));
        Assert.NotEqual(LayerTarget.FromRef("hero"), LayerTarget.FromRef("hero", "canvas"));
    }
}
