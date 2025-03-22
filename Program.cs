using Microsoft.Extensions.FileProviders;

//var builder = WebApplication.CreateBuilder(args);
var builder = WebApplication.CreateBuilder(
    new WebApplicationOptions()
    {
        WebRootPath = "dist"
    }
);

var app = builder.Build();

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "dist")),

    OnPrepareResponse = ctx =>
    {
        var filePath = ctx.File.PhysicalPath;
        if (!File.Exists(filePath) && File.Exists(filePath + ".js"))
        {
            var jsFilePath = filePath + ".js";
            if (File.Exists(jsFilePath))
            {
                ctx.Context.Response.Redirect(ctx.Context.Request.Path + ".js");
            }
        }
    }
});

app.MapGet("/", (context) =>
{
    context.Response.Redirect("/index.html");
    return Task.CompletedTask;
});

app.MapFallback(async (context) =>
{
    var path = context.Request.Path.Value;
    var fileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "dist"));
    if (!string.IsNullOrEmpty(path))
    {
        var js = fileProvider.GetFileInfo(path + ".js");
        if (js.Exists)
        {
            context.Response.StatusCode = 200;
            context.Response.ContentType = "text/javascript";
            context.Response.Headers.Append("Cache-Control", "no-cache");
            context.Response.ContentLength = js.Length;
            
            using (var stream = js.CreateReadStream())
            {
                await stream.CopyToAsync(context.Response.Body);
            }
        }
    }

    //return Task.CompletedTask;
});

app.Run();
