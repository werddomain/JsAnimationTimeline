// dotnet/tools/JsTimeline.SchemaGen/CodeWriter.cs
using System.Text;

namespace JsTimeline.SchemaGen;

/// <summary>Writes indented C# lines with "\n" line endings, whatever the platform.</summary>
internal sealed class CodeWriter
{
    private const string IndentUnit = "    ";
    private readonly StringBuilder _builder = new();
    private int _indent;

    public CodeWriter Line(string text = "")
    {
        if (text.Length > 0)
        {
            for (var i = 0; i < _indent; i++)
            {
                _builder.Append(IndentUnit);
            }
            _builder.Append(text);
        }
        _builder.Append('\n');
        return this;
    }

    public CodeWriter Open(string header)
    {
        Line(header);
        Line("{");
        _indent++;
        return this;
    }

    public CodeWriter Close(string suffix = "")
    {
        _indent--;
        return Line("}" + suffix);
    }

    /// <summary>A /// summary, skipped when the text is empty.</summary>
    public CodeWriter Summary(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return this;
        }
        return Line("/// <summary>" + Naming.Xml(text) + "</summary>");
    }

    public override string ToString() => _builder.ToString();
}
