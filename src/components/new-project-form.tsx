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
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { renderModelPreview } from "@/lib/model-preview";

const PART_TYPES = [
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
type PartType = (typeof PART_TYPES)[number];

type NewProjectFormProps = React.ComponentPropsWithoutRef<"div"> & {
  onSuccess?: () => void;
};

export function NewProjectForm({
  className,
  onSuccess,
  ...props
}: NewProjectFormProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<
    "blank" | "import" | "template" | null
  >(null);
  const [templateType, setTemplateType] = useState<
    "stratocaster" | "telecaster" | "les-paul" | null
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [partType, setPartType] = useState<PartType | "">("");

  async function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }

    if (!projectType) {
      setError("Select a project type.");
      return;
    }

    setIsSubmitting(true);
    try {
      const body: {
        name: string;
        mode: "blank" | "import" | "template";
        templateId?: string;
        importAssetId?: string;
      } = {
        name: projectName.trim(),
        mode: projectType,
      };

      if (projectType === "template") {
        if (!templateType) {
          setError("Select a template.");
          setIsSubmitting(false);
          return;
        }

        const templateRes = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateKey: templateType }),
        });

        const templateData = await templateRes.json();
        if (!templateRes.ok) {
          throw new Error(
            templateData?.error ?? "Template asset create failed",
          );
        }

        body.templateId = templateData.assetId;
      }

      if (projectType === "import") {
        if (!file) {
          setError("Please select a file to import.");
          setIsSubmitting(false);
          return;
        }

        if (!assetName.trim()) {
          setError("Asset name is required for import.");
          setIsSubmitting(false);
          return;
        }

        if (!partType) {
          setError("Part type is required for import.");
          setIsSubmitting(false);
          return;
        }

        const modelPresignRes = await fetch("/api/models/import/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "model",
            filename: file.name,
            contentType: file.type || "model/gltf-binary",
          }),
        });

        const modelPresignData = await modelPresignRes.json();
        if (!modelPresignRes.ok) {
          throw new Error(modelPresignData?.error ?? "Model presign failed");
        }

        const modelPutRes = await fetch(modelPresignData.url, {
          method: "PUT",
          headers: { "Content-Type": modelPresignData.contentType },
          body: file,
        });

        if (!modelPutRes.ok) {
          throw new Error("S3 upload failed");
        }

        const previewBlob = await renderModelPreview(file);
        const previewPresignRes = await fetch("/api/models/import/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "preview",
            uploadID: modelPresignData.uploadID,
            filename: "preview.png",
            contentType: "image/png",
          }),
        });

        const previewPresignData = await previewPresignRes.json();
        if (!previewPresignRes.ok) {
          throw new Error(
            previewPresignData?.error ?? "Preview presign failed",
          );
        }

        const previewPutRes = await fetch(previewPresignData.url, {
          method: "PUT",
          headers: { "Content-Type": previewPresignData.contentType },
          body: previewBlob,
        });

        if (!previewPutRes.ok) {
          throw new Error("S3 preview upload failed");
        }

        const finalizeRes = await fetch("/api/models/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectKey: modelPresignData.objectKey,
            filename: file.name,
            contentType: modelPresignData.contentType,
            bytes: file.size,
            previewObjectKey: previewPresignData.objectKey,
            previewFilename: "preview.png",
            previewContentType: previewPresignData.contentType,
            previewBytes: previewBlob.size,
            assetName: assetName.trim(),
            partType,
          }),
        });

        const finalizeData = await finalizeRes.json();
        if (!finalizeRes.ok) {
          throw new Error(finalizeData?.error ?? "Finalize import failed");
        }

        body.importAssetId = finalizeData.assetId;
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Create failed");
      }

      const newProjectId = data?.id;
      if (!newProjectId) {
        throw new Error("Project created, but no ID returned");
      }

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
                  variant={projectType === "blank" ? "secondary" : "outline"}
                  onClick={() => setProjectType("blank")}
                >
                  Blank
                </Button>
                <Button
                  type="button"
                  variant={projectType === "import" ? "secondary" : "outline"}
                  onClick={() => {
                    setProjectType("import");
                    setIsImporting(false);
                  }}
                >
                  Import
                </Button>
                <Button
                  type="button"
                  variant={projectType === "template" ? "secondary" : "outline"}
                  onClick={() => {
                    setProjectType("template");
                    setIsImporting(false);
                  }}
                >
                  Template
                </Button>
              </div>
              {projectType === "import" && (
                <div>
                  <div className="mt-4 flex gap-2">
                    <Label htmlFor="filename"></Label>
                    <input
                      id="filename"
                      type="file"
                      className="text-sm"
                      onChange={(e) => {
                        setIsImporting(true);
                        onImportFileChange(e);
                      }}
                    />
                  </div>
                  <br />
                  {isImporting && (
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
                            {PART_TYPES.map((type) => (
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
                  )}
                </div>
              )}
              {projectType === "template" && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Button
                    type="button"
                    variant={
                      templateType === "stratocaster" ? "secondary" : "outline"
                    }
                    onClick={() => setTemplateType("stratocaster")}
                    className="h-auto p-2"
                  >
                    <div className="relative h-24 w-full overflow-hidden rounded-md">
                      <Image
                        src="/thumbnails/stratocaster-template.jpg"
                        alt="Stratocaster"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      <span className="relative z-10 font-bold text-(--primary)">
                        Stratocaster
                      </span>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant={
                      templateType === "telecaster" ? "secondary" : "outline"
                    }
                    onClick={() => setTemplateType("telecaster")}
                    className="h-auto p-2"
                  >
                    <div className="relative h-24 w-full overflow-hidden rounded-md">
                      <Image
                        src="/thumbnails/telecaster-template.jpg"
                        alt="Telecaster"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      <span className="relative z-10 font-bold text-(--primary)">
                        Telecaster
                      </span>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant={
                      templateType === "les-paul" ? "secondary" : "outline"
                    }
                    onClick={() => setTemplateType("les-paul")}
                    className="h-auto p-2"
                  >
                    <div className="relative h-24 w-full overflow-hidden rounded-md">
                      <Image
                        src="/thumbnails/lespaul-template.jpg"
                        alt="Les Paul"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      <span className="relative z-10 font-bold text-(--primary)">
                        Les Paul
                      </span>
                    </div>
                  </Button>
                </div>
              )}
              {error && <p className="flex justify-center">{error}</p>}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full border border-(--primary)"
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
