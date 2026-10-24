// dotnet/tools/JsTimeline.SchemaGen/TypeModels.cs
namespace JsTimeline.SchemaGen;

/// <summary>A C# type to emit, read from a schema definition.</summary>
internal abstract record TypeModel(string Name, string? Description);

/// <summary>A property of an object or of a flat union.</summary>
/// <param name="JsonName">Name in the JSON document.</param>
/// <param name="ClrName">C# property name.</param>
/// <param name="ClrType">C# type, without the nullable mark.</param>
/// <param name="Required">Listed in "required".</param>
/// <param name="Description">Schema description.</param>
/// <param name="DefaultText">Schema default, as JSON text, for the doc comment.</param>
/// <param name="ConstValue">Schema const: the property is a fixed discriminator.</param>
/// <param name="MinLength">Schema minLength of a string.</param>
/// <param name="IsValueType">The C# type is a struct (number, boolean, enum): JSON null cannot reach it.</param>
internal sealed record PropertyModel(
    string JsonName,
    string ClrName,
    string ClrType,
    bool Required,
    string? Description,
    string? DefaultText,
    string? ConstValue,
    int? MinLength,
    bool IsValueType);

/// <summary>An object with fixed properties ("additionalProperties": false when Closed).</summary>
internal sealed record ObjectModel(
    string Name,
    string? Description,
    IReadOnlyList<PropertyModel> Properties,
    bool Closed,
    string? BaseName) : TypeModel(Name, Description);

/// <summary>A string enum.</summary>
internal sealed record EnumModel(string Name, string? Description, IReadOnlyList<string> Values)
    : TypeModel(Name, Description);

/// <summary>A oneOf whose variants carry a const discriminator ("type": "layer" | "folder").</summary>
internal sealed record UnionModel(
    string Name,
    string? Description,
    string DiscriminatorJsonName,
    IReadOnlyList<UnionVariant> Variants) : TypeModel(Name, Description);

internal sealed record UnionVariant(string DiscriminatorValue, string TypeName);

/// <summary>
/// A oneOf of objects told apart by their keys ({ selector } | { ref, stage? }), emitted as one flat
/// class with every property optional and an exactly-one rule checked on read and write.
/// </summary>
internal sealed record FlatUnionModel(
    string Name,
    string? Description,
    IReadOnlyList<PropertyModel> Properties,
    IReadOnlyList<FlatVariant> Variants) : TypeModel(Name, Description);

/// <param name="FactoryName">Name of the static factory, "FromSelector".</param>
/// <param name="RequiredJsonNames">Keys that select this variant.</param>
/// <param name="AllowedJsonNames">Every key the variant accepts.</param>
internal sealed record FlatVariant(
    string FactoryName,
    IReadOnlyList<string> RequiredJsonNames,
    IReadOnlyList<string> AllowedJsonNames);
