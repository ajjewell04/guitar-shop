import { describe, it, expect } from "vitest";
import {
  CreateProjectBodySchema,
  DeleteProjectBodySchema,
  UpdateProjectPreviewBodySchema,
  PresignProjectPreviewBodySchema,
  PromoteProjectRootBodySchema,
} from "../dto";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("CreateProjectBodySchema", () => {
  it("accepts name only and defaults mode to blank", () => {
    const result = CreateProjectBodySchema.parse({ name: "My Guitar" });
    expect(result.mode).toBe("blank");
  });
  it("accepts all valid mode values", () => {
    expect(() =>
      CreateProjectBodySchema.parse({ name: "x", mode: "blank" }),
    ).not.toThrow();
    expect(() =>
      CreateProjectBodySchema.parse({ name: "x", mode: "import" }),
    ).not.toThrow();
    expect(() =>
      CreateProjectBodySchema.parse({ name: "x", mode: "template" }),
    ).not.toThrow();
  });
  it("rejects empty name", () => {
    expect(() => CreateProjectBodySchema.parse({ name: "" })).toThrow();
  });
  it("rejects name longer than 50 characters", () => {
    expect(() =>
      CreateProjectBodySchema.parse({ name: "a".repeat(51) }),
    ).toThrow();
  });
  it("accepts name at exactly 50 characters", () => {
    expect(() =>
      CreateProjectBodySchema.parse({ name: "a".repeat(50) }),
    ).not.toThrow();
  });
  it("rejects invalid mode", () => {
    expect(() =>
      CreateProjectBodySchema.parse({ name: "x", mode: "invalid" }),
    ).toThrow();
  });
  it("accepts optional templateId as UUID", () => {
    expect(() =>
      CreateProjectBodySchema.parse({
        name: "x",
        mode: "template",
        templateId: UUID,
      }),
    ).not.toThrow();
  });
  it("rejects non-UUID templateId", () => {
    expect(() =>
      CreateProjectBodySchema.parse({ name: "x", templateId: "bad" }),
    ).toThrow();
  });
});

describe("DeleteProjectBodySchema", () => {
  it("accepts valid UUID id", () => {
    expect(() => DeleteProjectBodySchema.parse({ id: UUID })).not.toThrow();
  });
  it("rejects non-UUID id", () => {
    expect(() => DeleteProjectBodySchema.parse({ id: "not-a-uuid" })).toThrow();
  });
  it("rejects missing id", () => {
    expect(() => DeleteProjectBodySchema.parse({})).toThrow();
  });
});

describe("UpdateProjectPreviewBodySchema", () => {
  const validBase = { projectId: UUID, previewObjectKey: "previews/thumb.png" };

  it("accepts valid input", () => {
    expect(() => UpdateProjectPreviewBodySchema.parse(validBase)).not.toThrow();
  });
  it("defaults previewContentType to image/png", () => {
    const result = UpdateProjectPreviewBodySchema.parse(validBase);
    expect(result.previewContentType).toBe("image/png");
  });
  it("rejects negative previewBytes", () => {
    expect(() =>
      UpdateProjectPreviewBodySchema.parse({ ...validBase, previewBytes: -1 }),
    ).toThrow();
  });
  it("accepts null previewBytes", () => {
    expect(() =>
      UpdateProjectPreviewBodySchema.parse({
        ...validBase,
        previewBytes: null,
      }),
    ).not.toThrow();
  });
  it("accepts zero previewBytes", () => {
    expect(() =>
      UpdateProjectPreviewBodySchema.parse({ ...validBase, previewBytes: 0 }),
    ).not.toThrow();
  });
  it("rejects missing projectId", () => {
    expect(() =>
      UpdateProjectPreviewBodySchema.parse({ previewObjectKey: "key.png" }),
    ).toThrow();
  });
  it("rejects non-UUID projectId", () => {
    expect(() =>
      UpdateProjectPreviewBodySchema.parse({ ...validBase, projectId: "bad" }),
    ).toThrow();
  });
});

describe("PresignProjectPreviewBodySchema", () => {
  it("accepts valid UUID projectId", () => {
    expect(() =>
      PresignProjectPreviewBodySchema.parse({ projectId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID projectId", () => {
    expect(() =>
      PresignProjectPreviewBodySchema.parse({ projectId: "bad" }),
    ).toThrow();
  });
  it("rejects missing projectId", () => {
    expect(() => PresignProjectPreviewBodySchema.parse({})).toThrow();
  });
});

describe("PromoteProjectRootBodySchema", () => {
  it("accepts two valid UUIDs", () => {
    expect(() =>
      PromoteProjectRootBodySchema.parse({
        projectId: UUID,
        newRootNodeId: UUID2,
      }),
    ).not.toThrow();
  });
  it("rejects missing projectId", () => {
    expect(() =>
      PromoteProjectRootBodySchema.parse({ newRootNodeId: UUID2 }),
    ).toThrow();
  });
  it("rejects missing newRootNodeId", () => {
    expect(() =>
      PromoteProjectRootBodySchema.parse({ projectId: UUID }),
    ).toThrow();
  });
  it("rejects non-UUID projectId", () => {
    expect(() =>
      PromoteProjectRootBodySchema.parse({
        projectId: "bad",
        newRootNodeId: UUID2,
      }),
    ).toThrow();
  });
  it("rejects non-UUID newRootNodeId", () => {
    expect(() =>
      PromoteProjectRootBodySchema.parse({
        projectId: UUID,
        newRootNodeId: "bad",
      }),
    ).toThrow();
  });
});
