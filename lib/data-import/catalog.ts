import type { DestinationField, FieldMapping, ImportPreset, TransformKind } from "./types";

export const PRODUCT_DESTINATION_FIELDS: DestinationField[] = [
  { key: "externalId", label: "External ID", defaultTransform: "text", aliases: ["external id", "external code", "product code", "item code", "code", "codigo", "código", "sku"] },
  { key: "slug", label: "Slug", defaultTransform: "slug", aliases: ["slug", "product slug"] },
  { key: "name", label: "Name", defaultTransform: "text", aliases: ["name", "product", "product name", "description", "descricao", "descrição"] },
  { key: "stock", label: "Stock", defaultTransform: "number", aliases: ["stock", "qty", "quantity", "available", "available qty", "inventory", "estoque", "quantidade", "qtd"] },
  { key: "publicPrice", label: "Public price", defaultTransform: "currency", aliases: ["public price", "price", "unit price", "price cad", "preco", "preço", "valor"] },
  { key: "currency", label: "Currency", defaultTransform: "text", aliases: ["currency", "moeda"] },
  { key: "active", label: "Active", defaultTransform: "boolean", aliases: ["active", "enabled", "ativo", "status"] },
  { key: "series", label: "Category", defaultTransform: "text", aliases: ["series", "category", "categoria"] },
  { key: "category", label: "Subcategory", defaultTransform: "text", aliases: ["subcategory", "sub category", "subcategoria"] },
  { key: "description", label: "Description", defaultTransform: "text", aliases: ["long description", "details", "descricao longa", "descrição longa"] },
  { key: "sortOrder", label: "Sort order", defaultTransform: "number", aliases: ["sort order", "order", "ordem"] },
  { key: "unitWeight", label: "Unit weight", defaultTransform: "number", aliases: ["unit weight", "weight", "peso"] },
  { key: "weightUnit", label: "Weight unit", defaultTransform: "text", aliases: ["weight unit", "unit", "unidade peso"] },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function guessMappings(headers: string[], fields: DestinationField[] = PRODUCT_DESTINATION_FIELDS): FieldMapping[] {
  const usedTargets = new Set<string>();

  return headers.map((header) => {
    const normalizedHeader = normalize(header);
    let destination = fields.find((field) => {
      const candidates = [field.key, field.label, ...(field.aliases ?? [])].map(normalize);
      return candidates.includes(normalizedHeader) && !usedTargets.has(field.key);
    });

    if (!destination) {
      destination = fields.find((field) => {
        const candidates = [field.key, field.label, ...(field.aliases ?? [])].map(normalize);
        return candidates.some((candidate) => candidate && (candidate.includes(normalizedHeader) || normalizedHeader.includes(candidate))) && !usedTargets.has(field.key);
      });
    }

    if (destination) usedTargets.add(destination.key);

    return {
      source: header,
      target: destination?.key ?? "",
      transform: (destination?.defaultTransform ?? "text") as TransformKind,
      required: destination?.key === "externalId" || destination?.key === "slug",
    };
  });
}

export const BUILT_IN_PRESETS: ImportPreset[] = [
  {
    id: "generic-products",
    name: "Generic product import",
    description: "Reusable product import. Map any spreadsheet columns to product fields before previewing.",
    targetCollection: "products",
    identifierTarget: "slug",
    mode: "update-only",
    mappings: [],
  },
  {
    id: "starpro-ailit-products",
    name: "StarPro / Ailit products",
    description: "StarPro/Ailit preset. Column mapping is intentionally configurable so changes in exported spreadsheets do not require code changes.",
    targetCollection: "products",
    identifierTarget: "externalId",
    mode: "update-only",
    mappings: [],
  },
  {
    id: "bb-products",
    name: "BB products",
    description: "BB product spreadsheet preset using the same shared import engine.",
    targetCollection: "products",
    identifierTarget: "slug",
    mode: "update-only",
    mappings: [],
  },
];
