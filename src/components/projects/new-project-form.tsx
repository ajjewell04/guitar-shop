"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { renderModelPreview } from "@/lib/preview/model";

import {
  IMPORTABLE_PART_TYPES,
  type PartType,
  type ProjectMode,
  type TemplateType,
} from "@/components/projects/new-project/constants";
import { createProjectWithStrategy } from "@/components/projects/new-project/create-project";
import type { NewProjectFormState } from "@/components/projects/new-project/utils";

type NewProjectFormProps = React.ComponentPropsWithoutRef<"div"> & {
  onSuccess?: () => void;
};

type TemplatePreviewsResponse = {
  previews?: Partial<Record<TemplateType, string | null>>;
  error?: string;
};

const TEMPLATES: { id: TemplateType; label: string }[] = [
  { id: "stratocaster", label: "Stratocaster" },
  { id: "telecaster", label: "Telecaster" },
  { id: "les-paul", label: "Les Paul" },
];

export function NewProjectForm({
  className,
  onSuccess,
  ...props
}: NewProjectFormProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectMode | null>(null);
  const [templateType, setTemplateType] = useState<TemplateType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [partType, setPartType] = useState<PartType | "">("");
  const [templatePreviews, setTemplatePreviews] = useState<
    Partial<Record<TemplateType, string>>
  >({});
  const [templatePreviewError, setTemplatePreviewError] = useState<
    string | null
  >(null);
  const [brokenPreview, setBrokenPreview] = useState<
    Partial<Record<TemplateType, boolean>>
  >({});

  function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  }

  function validateBeforeSubmit(mode: ProjectMode | null): mode is ProjectMode {
    if (!projectName.trim()) {
      setError("Project name is required.");
      return false;
    }
    if (!mode) {
      setError("Select a project type.");
      return false;
    }
    if (mode === "template" && !templateType) {
      setError("Select a template.");
      return false;
    }
    if (mode === "import") {
      if (!file) {
        setError("Please select a file to import.");
        return false;
      }
      if (!assetName.trim()) {
        setError("Asset name is required for import.");
        return false;
      }
      if (!partType) {
        setError("Part type is required for import.");
        return false;
      }
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!validateBeforeSubmit(projectType)) return;

    setIsSubmitting(true);
    try {
      const state: NewProjectFormState = {
        projectName,
        mode: projectType,
        templateType,
        file,
        assetName,
        partType,
      };

      const newProjectId = await createProjectWithStrategy(state, {
        renderModelPreview,
      });

      onSuccess?.();
      window.dispatchEvent(new Event("projects-changed"));
      router.push(`/projects/${newProjectId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    let active = true;

    const loadTemplatePreviews = async () => {
      try {
        const res = await fetch("/api/assets/templates", { cache: "no-store" });
        const payload = (await res
          .json()
          .catch(() => ({}))) as TemplatePreviewsResponse;

        if (!res.ok) {
          throw new Error(payload.error ?? "Failed to load template previews");
        }

        if (!active) return;

        const next: Partial<Record<TemplateType, string>> = {};
        (
          Object.entries(payload.previews ?? {}) as Array<
            [TemplateType, string | null | undefined]
          >
        ).forEach(([key, value]) => {
          if (value) next[key] = value;
        });

        setTemplatePreviews(next);
        setTemplatePreviewError(null);
      } catch (e) {
        if (!active) return;
        setTemplatePreviewError(
          e instanceof Error ? e.message : "Template previews unavailable",
        );
      }
    };

    void loadTemplatePreviews();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={cn(className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <CardDescription>Select a project type:</CardDescription>
              <div className="flex flex-wrap gap-2 justify-around">
                <Button
                  type="button"
                  className="cursor-pointer"
                  variant={projectType === "blank" ? "secondary" : "outline"}
                  onClick={() => setProjectType("blank")}
                >
                  Blank
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  variant={projectType === "import" ? "secondary" : "outline"}
                  onClick={() => {
                    setProjectType("import");
                    setHasSelectedFile(false);
                  }}
                >
                  Import
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  variant={projectType === "template" ? "secondary" : "outline"}
                  onClick={() => {
                    setProjectType("template");
                    setHasSelectedFile(false);
                  }}
                >
                  Template
                </Button>
              </div>

              {projectType === "import" && (
                <div>
                  <div className="mt-4">
                    <input
                      id="filename"
                      type="file"
                      className="text-sm"
                      onChange={(e) => {
                        setHasSelectedFile(true);
                        onImportFileChange(e);
                      }}
                    />
                  </div>
                  <br />
                  {hasSelectedFile && (
                    <div className="space-y-4">
                      <div className="flex flex-row gap-4">
                        <div className="flex-1 min-w-0">
                          <Label htmlFor="asset-name">Asset Name</Label>
                          <Input
                            id="asset-name"
                            type="text"
                            value={assetName}
                            onChange={(e) => setAssetName(e.target.value)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label htmlFor="part-type">Part Type</Label>
                          <Select
                            value={partType}
                            onValueChange={(value) =>
                              setPartType(value as PartType)
                            }
                          >
                            <SelectTrigger
                              id="part-type"
                              className="w-full bg-(--background) text-(--foreground) border-(--foreground)"
                            >
                              <SelectValue placeholder="Select part type" />
                            </SelectTrigger>
                            <SelectContent className="bg-(--background) text-(--foreground) border-(--foreground)">
                              {IMPORTABLE_PART_TYPES.map((type) => (
                                <SelectItem
                                  key={type}
                                  value={type}
                                  className="focus:bg-(--primary) focus:text-(--foreground)"
                                >
                                  {type.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {projectType === "template" && (
                <div className="mt-4">
                  {templatePreviewError && (
                    <p className="mb-3 text-sm text-red-500">
                      {templatePreviewError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {TEMPLATES.map((template) => {
                      const src = templatePreviews[template.id];
                      const failed = brokenPreview[template.id] || !src;

                      return (
                        <Button
                          key={template.id}
                          type="button"
                          variant={
                            templateType === template.id
                              ? "secondary"
                              : "outline"
                          }
                          onClick={() => setTemplateType(template.id)}
                          className="cursor-pointer h-auto p-2"
                        >
                          <div className="relative h-24 w-full overflow-hidden rounded-md">
                            {!failed ? (
                              <Image
                                src={src}
                                alt={template.label}
                                fill
                                className="object-cover"
                                onError={() =>
                                  setBrokenPreview((prev) => ({
                                    ...prev,
                                    [template.id]: true,
                                  }))
                                }
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-black/20 text-xs text-muted-foreground">
                                Preview unavailable
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20" />
                            <span className="relative z-10 font-bold text-(--primary)">
                              {template.label}
                            </span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <p className="flex justify-center">{error}</p>}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full border border-(--primary)"
              >
                {isSubmitting ? "Creating..." : "Submit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
