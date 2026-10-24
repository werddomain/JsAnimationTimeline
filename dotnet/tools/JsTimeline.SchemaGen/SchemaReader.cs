// dotnet/tools/JsTimeline.SchemaGen/SchemaReader.cs
using System.Text.Json.Nodes;

namespace JsTimeline.SchemaGen;

/// <summary>
/// Reads the "$defs" of a JSON schema into <see cref="TypeModel"/>s. Only the shapes used by
/// schema/timeline.schema.json are supported; anything else throws <see cref="NotSupportedException"/>
/// with its schema path, so a schema change never yields a silently wrong model.
/// </summary>
internal sealed class SchemaReader
{
    private const string DefsPrefix = "#/$defs/";

    private readonly JsonObject _defs;
    private readonly List<TypeModel> _types = new();
    private readonly Dictionary<string, string> _baseOfVariant = new(StringComparer.Ordinal);
    private readonly HashSet<string> _flatVariants = new(StringComparer.Ordinal);

    private SchemaReader(JsonObject defs) => _defs = defs;

    public static IReadOnlyList<TypeModel> Read(JsonObject schema)
    {
        var defs = schema["$defs"] as JsonObject
            ?? throw new NotSupportedException("The schema has no \"$defs\" object.");
        var reader = new SchemaReader(defs);
        reader.CollectUnionBases();
        foreach (var (name, node) in defs)
        {
            reader.ReadDefinition(name, AsObject(node, DefsPrefix + name));
        }
        return reader._types;
    }

    /// <summary>
    /// Finds the variants of every oneOf first: a discriminated variant derives from its union, and a
    /// variant of a flat union is folded into the flat class instead of being emitted on its own.
    /// </summary>
    private void CollectUnionBases()
    {
        foreach (var (name, node) in _defs)
        {
            if (node is not JsonObject def)
            {
                continue;
            }
            if (def["oneOf"] is JsonArray oneOf)
            {
                CollectUnion(name, oneOf);
            }
            if (def["properties"] is JsonObject properties)
            {
                foreach (var (_, property) in properties)
                {
                    if (property?["oneOf"] is JsonArray inline)
                    {
                        CollectUnion(null, inline);
                    }
                }
            }
        }
    }

    private void CollectUnion(string? name, JsonArray oneOf)
    {
        if (name is not null && TryGetDiscriminator(oneOf, out _, out var variants))
        {
            foreach (var variant in variants)
            {
                _baseOfVariant[variant.TypeName] = name;
            }
            return;
        }
        foreach (var (variantName, _) in VariantDefinitions(oneOf, "oneOf"))
        {
            _flatVariants.Add(variantName);
        }
    }

    private void ReadDefinition(string name, JsonObject def)
    {
        var path = DefsPrefix + name;
        switch (KindOf(def, path))
        {
            case DefKind.Union:
                _types.Add(ReadUnion(name, Text(def, "description"), (JsonArray)def["oneOf"]!, path));
                break;
            case DefKind.Enum:
                _types.Add(ReadEnum(name, def, path));
                break;
            case DefKind.Object when !_flatVariants.Contains(name):
                _types.Add(ReadObject(name, def, path));
                break;
            case DefKind.Object:
            case DefKind.Scalar:
            case DefKind.Map:
                break; // Inlined where they are used.
        }
    }

    private ObjectModel ReadObject(string name, JsonObject def, string path)
    {
        var properties = AsObject(def["properties"], path + "/properties");
        var required = RequiredSet(def);
        var models = new List<PropertyModel>();
        var pending = new List<TypeModel>();
        foreach (var (jsonName, node) in properties)
        {
            models.Add(ReadProperty(name, jsonName, AsObject(node, $"{path}/properties/{jsonName}"),
                required.Contains(jsonName), pending));
        }
        _baseOfVariant.TryGetValue(name, out var baseName);
        var model = new ObjectModel(name, Text(def, "description"), models, IsClosed(def), baseName);
        _types.AddRange(pending);
        return model;
    }

    private PropertyModel ReadProperty(string owner, string jsonName, JsonObject node, bool required,
        List<TypeModel> pending)
    {
        var path = $"{DefsPrefix}{owner}/properties/{jsonName}";
        var referenced = Referenced(node);
        var constValue = node["const"] is JsonValue constNode ? ConstText(constNode, path) : null;
        var clrType = constValue is null
            ? ResolveType(node, path, owner + Naming.Pascal(jsonName), pending)
            : "string";
        return new PropertyModel(
            jsonName,
            Naming.Pascal(jsonName),
            clrType,
            required,
            Text(node, "description") ?? (referenced is null ? null : Text(referenced, "description")),
            (node["default"] ?? referenced?["default"])?.ToJsonString(),
            constValue,
            IntValue(node, "minLength") ?? (referenced is null ? null : IntValue(referenced, "minLength")),
            clrType is "int" or "double" or "bool" || referenced?["enum"] is not null);
    }

    private static string ConstText(JsonValue node, string path) =>
        node.TryGetValue<string>(out var text)
            ? text
            : throw new NotSupportedException($"{path}: only string \"const\" values are supported.");

    private string ResolveType(JsonObject node, string path, string inlineName, List<TypeModel> pending)
    {
        if (node["$ref"] is not null)
        {
            var name = RefName(node, path);
            if (_flatVariants.Contains(name))
            {
                throw new NotSupportedException($"{path}: \"{name}\" is a flat oneOf variant and cannot be used on its own.");
            }
            var def = AsObject(_defs[name], DefsPrefix + name);
            return KindOf(def, DefsPrefix + name) switch
            {
                DefKind.Scalar => ScalarType(def, DefsPrefix + name),
                DefKind.Map => MapType(def, DefsPrefix + name, pending),
                _ => name,
            };
        }
        if (node["oneOf"] is JsonArray oneOf)
        {
            pending.Add(ReadUnion(inlineName, Text(node, "description"), oneOf, path));
            return inlineName;
        }
        return Text(node, "type") switch
        {
            "array" => $"IReadOnlyList<{ResolveType(AsObject(node["items"], path + "/items"), path + "/items", inlineName + "Item", pending)}>",
            "object" => MapType(node, path, pending),
            _ => ScalarType(node, path),
        };
    }

    private string MapType(JsonObject node, string path, List<TypeModel> pending)
    {
        var values = AsObject(node["additionalProperties"], path + "/additionalProperties");
        return $"IReadOnlyDictionary<string, {ResolveType(values, path + "/additionalProperties", "Item", pending)}>";
    }

    private static string ScalarType(JsonObject node, string path) => Text(node, "type") switch
    {
        "string" => "string",
        "integer" => "int",
        "number" => "double",
        "boolean" => "bool",
        var other => throw new NotSupportedException($"{path}: type \"{other}\" is not supported."),
    };

    private TypeModel ReadUnion(string name, string? description, JsonArray oneOf, string path)
    {
        if (TryGetDiscriminator(oneOf, out var discriminator, out var variants))
        {
            if (!_defs.ContainsKey(name))
            {
                throw new NotSupportedException($"{path}: a discriminated oneOf must be a \"$defs\" entry.");
            }
            return new UnionModel(name, description, discriminator, variants);
        }
        return ReadFlatUnion(name, description, VariantDefinitions(oneOf, path), path);
    }

    private FlatUnionModel ReadFlatUnion(string name, string? description,
        IReadOnlyList<(string Name, JsonObject Def)> variants, string path)
    {
        var properties = new Dictionary<string, PropertyModel>(StringComparer.Ordinal);
        var flatVariants = new List<FlatVariant>();
        var prefixes = DistinctPrefixes(variants.Select(v => v.Name).ToList());
        var pending = new List<TypeModel>();
        for (var i = 0; i < variants.Count; i++)
        {
            var (variantName, def) = variants[i];
            var variantPath = DefsPrefix + variantName;
            if (!IsClosed(def))
            {
                throw new NotSupportedException($"{variantPath}: a flat oneOf variant needs \"additionalProperties\": false.");
            }
            var required = RequiredSet(def);
            if (required.Count == 0)
            {
                throw new NotSupportedException($"{variantPath}: a flat oneOf variant needs a required key.");
            }
            var allowed = new List<string>();
            foreach (var (jsonName, node) in AsObject(def["properties"], variantPath + "/properties"))
            {
                var property = ReadProperty(variantName, jsonName, AsObject(node, $"{variantPath}/properties/{jsonName}"), false, pending)
                    with { Required = false };
                if (properties.TryGetValue(jsonName, out var existing) && existing.ClrType != property.ClrType)
                {
                    throw new NotSupportedException($"{path}: \"{jsonName}\" has different types in the variants.");
                }
                properties.TryAdd(jsonName, property);
                allowed.Add(jsonName);
            }
            flatVariants.Add(new FlatVariant("From" + prefixes[i], required.Order(StringComparer.Ordinal).ToList(), allowed));
        }
        if (pending.Count > 0)
        {
            throw new NotSupportedException($"{path}: nested inline types in a flat oneOf are not supported.");
        }
        return new FlatUnionModel(name, description, properties.Values.ToList(), flatVariants);
    }

    private bool TryGetDiscriminator(JsonArray oneOf, out string discriminator, out List<UnionVariant> variants)
    {
        discriminator = string.Empty;
        variants = new List<UnionVariant>();
        var definitions = VariantDefinitions(oneOf, "oneOf");
        var first = definitions[0].Def["properties"] as JsonObject;
        if (first is null)
        {
            return false;
        }
        foreach (var (candidate, _) in first)
        {
            var values = definitions
                .Select(d => (d.Def["properties"] as JsonObject)?[candidate]?["const"] as JsonValue)
                .ToList();
            if (values.All(v => v is not null && v.TryGetValue<string>(out _)))
            {
                discriminator = candidate;
                variants = definitions.Select((d, i) => new UnionVariant(values[i]!.GetValue<string>(), d.Name)).ToList();
                return true;
            }
        }
        return false;
    }

    private List<(string Name, JsonObject Def)> VariantDefinitions(JsonArray oneOf, string path)
    {
        var result = new List<(string, JsonObject)>();
        foreach (var item in oneOf)
        {
            var name = RefName(AsObject(item, path), path);
            var def = AsObject(_defs[name], DefsPrefix + name);
            if (KindOf(def, DefsPrefix + name) != DefKind.Object)
            {
                throw new NotSupportedException($"{path}: oneOf variants must be objects with properties.");
            }
            result.Add((name, def));
        }
        if (result.Count < 2)
        {
            throw new NotSupportedException($"{path}: a oneOf needs at least two variants.");
        }
        return result;
    }

    /// <summary>"SelectorTarget", "RefTarget" → "Selector", "Ref" (drops the longest shared word suffix).</summary>
    internal static IReadOnlyList<string> DistinctPrefixes(IReadOnlyList<string> names)
    {
        var first = names[0];
        for (var start = 1; start < first.Length; start++)
        {
            if (!char.IsUpper(first[start]))
            {
                continue;
            }
            var suffix = first[start..];
            if (names.All(n => n.Length > suffix.Length && n.EndsWith(suffix, StringComparison.Ordinal)))
            {
                return names.Select(n => n[..^suffix.Length]).ToList();
            }
        }
        return names;
    }

    private EnumModel ReadEnum(string name, JsonObject def, string path)
    {
        var values = AsArray(def["enum"], path + "/enum")
            .Select(v => v is JsonValue value && value.TryGetValue<string>(out var text)
                ? text
                : throw new NotSupportedException($"{path}: only string enums are supported."))
            .ToList();
        return new EnumModel(name, Text(def, "description"), values);
    }

    private enum DefKind { Object, Enum, Union, Scalar, Map }

    private static DefKind KindOf(JsonObject def, string path)
    {
        if (def["oneOf"] is not null)
        {
            return DefKind.Union;
        }
        if (def["enum"] is not null)
        {
            return DefKind.Enum;
        }
        return Text(def, "type") switch
        {
            "object" when def["properties"] is JsonObject => DefKind.Object,
            "object" when def["additionalProperties"] is JsonObject => DefKind.Map,
            "string" or "integer" or "number" or "boolean" => DefKind.Scalar,
            _ => throw new NotSupportedException($"{path}: this definition shape is not supported."),
        };
    }

    private string RefName(JsonObject node, string path)
    {
        var reference = Text(node, "$ref") ?? throw new NotSupportedException($"{path}: \"$ref\" expected.");
        if (!reference.StartsWith(DefsPrefix, StringComparison.Ordinal))
        {
            throw new NotSupportedException($"{path}: only \"{DefsPrefix}...\" references are supported.");
        }
        var name = reference[DefsPrefix.Length..];
        return _defs.ContainsKey(name)
            ? name
            : throw new NotSupportedException($"{path}: \"{reference}\" points to no definition.");
    }

    private JsonObject? Referenced(JsonObject node) =>
        node["$ref"] is null ? null : _defs[RefName(node, "$ref")] as JsonObject;

    private static HashSet<string> RequiredSet(JsonObject def) =>
        def["required"] is JsonArray required
            ? required.Select(r => r!.GetValue<string>()).ToHashSet(StringComparer.Ordinal)
            : new HashSet<string>(StringComparer.Ordinal);

    private static bool IsClosed(JsonObject def) =>
        def["additionalProperties"] is JsonValue value && value.TryGetValue<bool>(out var open) && !open;

    private static string? Text(JsonObject node, string key) =>
        node[key] is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;

    private static int? IntValue(JsonObject node, string key) =>
        node[key] is JsonValue value && value.TryGetValue<int>(out var number) ? number : null;

    private static JsonObject AsObject(JsonNode? node, string path) =>
        node as JsonObject ?? throw new NotSupportedException($"{path}: an object is expected.");

    private static JsonArray AsArray(JsonNode? node, string path) =>
        node as JsonArray ?? throw new NotSupportedException($"{path}: an array is expected.");
}
