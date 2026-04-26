import { describe, it, expect } from "vitest";
import {
  GetAssetsQuerySchema,
  DeleteAssetBodySchema,
  CreateAssetBodySchema,
  ExportAssetQuerySchema,
  ImportAssetBodySchema,
  PresignImportBodySchema,
  UpdateAssetPreviewBodySchema,
  PresignAssetPreviewBodySchema,
} from "./dto";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("GetAssetsQuerySchema", () => {
  it("accepts empty object", () => {
    expect(() => GetAssetsQuerySchema.parse({})).not.toThrow();
  });
  it("accepts valid UUID ownerId", () => {
    expect(() => GetAssetsQuerySchema.parse({ ownerId: UUID })).not.toThrow();
  });
  it("rejects non-UUID ownerId", () => {
    expect(() =>
      GetAssetsQuerySchema.parse({ ownerId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("DeleteAssetBodySchema", () => {
  it("accepts valid UUID assetId", () => {
    expect(() => DeleteAssetBodySchema.parse({ assetId: UUID })).not.toThrow();
  });
  it("rejects non-UUID assetId", () => {
    expect(() =>
      DeleteAssetBodySchema.parse({ assetId: "not-a-uuid" }),
    ).toThrow();
  });
  it("rejects missing assetId", () => {
    expect(() => DeleteAssetBodySchema.parse({})).toThrow();
  });
});

describe("CreateAssetBodySchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(() => CreateAssetBodySchema.parse({})).not.toThrow();
  });
  it("accepts valid mode values", () => {
    expect(() =>
      CreateAssetBodySchema.parse({ mode: "template" }),
    ).not.toThrow();
    expect(() =>
      CreateAssetBodySchema.parse({ mode: "copy_to_library" }),
    ).not.toThrow();
  });
  it("rejects invalid mode", () => {
    expect(() => CreateAssetBodySchema.parse({ mode: "invalid" })).toThrow();
  });
  it("accepts valid templateKey values", () => {
    expect(() =>
      CreateAssetBodySchema.parse({ templateKey: "stratocaster" }),
    ).not.toThrow();
    expect(() =>
      CreateAssetBodySchema.parse({ templateKey: "telecaster" }),
    ).not.toThrow();
    expect(() =>
      CreateAssetBodySchema.parse({ templateKey: "les-paul" }),
    ).not.toThrow();
  });
  it("rejects invalid templateKey", () => {
    expect(() =>
      CreateAssetBodySchema.parse({ templateKey: "strat" }),
    ).toThrow();
  });
  it("accepts valid sourceAssetId UUID", () => {
    expect(() =>
      CreateAssetBodySchema.parse({ sourceAssetId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID sourceAssetId", () => {
    expect(() =>
      CreateAssetBodySchema.parse({ sourceAssetId: "bad" }),
    ).toThrow();
  });
});

describe("ExportAssetQuerySchema", () => {
  it("accepts valid UUID projectId", () => {
    expect(() =>
      ExportAssetQuerySchema.parse({ projectId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID projectId", () => {
    expect(() => ExportAssetQuerySchema.parse({ projectId: "bad" })).toThrow();
  });
  it("rejects missing projectId", () => {
    expect(() => ExportAssetQuerySchema.parse({})).toThrow();
  });
});

describe("ImportAssetBodySchema", () => {
  const validBase = {
    objectKey: "uploads/model.glb",
    filename: "model.glb",
    assetName: "My Guitar Body",
    partType: "body",
    previewObjectKey: "uploads/preview.png",
  };

  it("accepts a complete valid body", () => {
    expect(() => ImportAssetBodySchema.parse(validBase)).not.toThrow();
  });

  it("accepts all optional fields", () => {
    expect(() =>
      ImportAssetBodySchema.parse({
        ...validBase,
        contentType: "model/gltf-binary",
        bytes: 1024,
        previewContentType: "image/png",
        previewBytes: 2048,
      }),
    ).not.toThrow();
  });

  const partTypes = [
    "body",
    "neck",
    "headstock",
    "bridge",
    "tuning_machine",
    "pickup",
    "pickguard",
    "knob",
    "switch",
    "strap_button",
    "output_jack",
    "miscellaneous",
  ] as const;

  it.each(partTypes)("accepts partType '%s'", (partType) => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, partType }),
    ).not.toThrow();
  });

  it("rejects invalid partType", () => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, partType: "instrument" }),
    ).toThrow();
  });

  it("rejects empty objectKey", () => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, objectKey: "" }),
    ).toThrow();
  });

  it("rejects empty filename", () => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, filename: "" }),
    ).toThrow();
  });

  it("rejects empty assetName", () => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, assetName: "" }),
    ).toThrow();
  });

  it("rejects negative bytes", () => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, bytes: -1 }),
    ).toThrow();
  });

  it("rejects negative previewBytes", () => {
    expect(() =>
      ImportAssetBodySchema.parse({ ...validBase, previewBytes: -1 }),
    ).toThrow();
  });
});

describe("PresignImportBodySchema", () => {
  it("accepts valid filename", () => {
    expect(() =>
      PresignImportBodySchema.parse({ filename: "model.glb" }),
    ).not.toThrow();
  });
  it("rejects empty filename", () => {
    expect(() => PresignImportBodySchema.parse({ filename: "" })).toThrow();
  });
  it("rejects missing filename", () => {
    expect(() => PresignImportBodySchema.parse({})).toThrow();
  });
  it("accepts optional contentType", () => {
    expect(() =>
      PresignImportBodySchema.parse({
        filename: "model.glb",
        contentType: "model/gltf-binary",
      }),
    ).not.toThrow();
  });
});

describe("UpdateAssetPreviewBodySchema", () => {
  const validBase = { assetId: UUID, previewObjectKey: "previews/thumb.png" };

  it("accepts valid input", () => {
    expect(() => UpdateAssetPreviewBodySchema.parse(validBase)).not.toThrow();
  });
  it("rejects non-UUID assetId", () => {
    expect(() =>
      UpdateAssetPreviewBodySchema.parse({ ...validBase, assetId: "bad" }),
    ).toThrow();
  });
  it("rejects empty previewObjectKey", () => {
    expect(() =>
      UpdateAssetPreviewBodySchema.parse({
        ...validBase,
        previewObjectKey: "",
      }),
    ).toThrow();
  });
  it("rejects negative previewBytes", () => {
    expect(() =>
      UpdateAssetPreviewBodySchema.parse({ ...validBase, previewBytes: -1 }),
    ).toThrow();
  });
  it("accepts zero previewBytes", () => {
    expect(() =>
      UpdateAssetPreviewBodySchema.parse({ ...validBase, previewBytes: 0 }),
    ).not.toThrow();
  });
});

describe("PresignAssetPreviewBodySchema", () => {
  it("accepts valid UUID assetId", () => {
    expect(() =>
      PresignAssetPreviewBodySchema.parse({ assetId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID assetId", () => {
    expect(() =>
      PresignAssetPreviewBodySchema.parse({ assetId: "bad" }),
    ).toThrow();
  });
  it("rejects missing assetId", () => {
    expect(() => PresignAssetPreviewBodySchema.parse({})).toThrow();
  });
});
