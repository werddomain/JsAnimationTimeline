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

app.Run();
