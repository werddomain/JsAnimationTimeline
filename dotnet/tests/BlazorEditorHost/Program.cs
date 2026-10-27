// dotnet/tests/BlazorEditorHost/Program.cs
using BlazorEditorHost.Components;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseStaticWebAssets();
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
var app = builder.Build();
app.UseStaticFiles();
app.UseAntiforgery();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

