// dotnet/tools/JsTimeline.SchemaGen/Naming.cs
using System.Text;

namespace JsTimeline.SchemaGen;

/// <summary>Turns JSON names into C# identifiers and text into XML doc comments.</summary>
internal static class Naming
{
    private static readonly HashSet<string> Keywords = new(StringComparer.Ordinal)
    {
        "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class", "const",
        "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
        "false", "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit", "in", "int", "interface",
        "internal", "is", "lock", "long", "namespace", "new", "null", "object", "operator", "out", "override",
        "params", "private", "protected", "public", "readonly", "ref", "return", "sbyte", "sealed", "short",
        "sizeof", "stackalloc", "static", "string", "struct", "switch", "this", "throw", "true", "try", "typeof",
        "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void", "volatile", "while",
    };

    /// <summary>"ease-in-out" → "EaseInOut", "totalFrames" → "TotalFrames".</summary>
    public static string Pascal(string jsonName)
    {
        var builder = new StringBuilder(jsonName.Length);
        var upperNext = true;
        foreach (var c in jsonName)
        {
            if (!char.IsAsciiLetterOrDigit(c))
            {
                upperNext = true;
                continue;
            }
            builder.Append(upperNext ? char.ToUpperInvariant(c) : c);
            upperNext = false;
        }
        if (builder.Length == 0 || char.IsAsciiDigit(builder[0]))
        {
            throw new NotSupportedException($"\"{jsonName}\" cannot be turned into a C# identifier.");
        }
        return builder.ToString();
    }

    /// <summary>A camelCase parameter name, prefixed with @ when it is a C# keyword ("ref" → "@ref").</summary>
    public static string Parameter(string jsonName)
    {
        var pascal = Pascal(jsonName);
        var camel = char.ToLowerInvariant(pascal[0]) + pascal[1..];
        return Keywords.Contains(camel) ? "@" + camel : camel;
    }

    /// <summary>Escapes text for an XML doc comment.</summary>
    public static string Xml(string text) =>
        OneLine(text).Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal);

    /// <summary>Escapes text for a regular C# string literal (without the quotes).</summary>
    public static string Literal(string text) =>
        OneLine(text).Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);

    /// <summary>Line breaks become spaces, so a description never breaks a generated line.</summary>
    private static string OneLine(string text) =>
        text.Replace("\r\n", " ", StringComparison.Ordinal).Replace('\r', ' ').Replace('\n', ' ');
}
