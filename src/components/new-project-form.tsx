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

import {
  PART_TYPES,
  type PartType,
  type ProjectMode,
  type TemplateType,
} from "@/components/new-project/constants";
import { createProjectWithStrategy } from "@/components/new-project/create-project";
import type { NewProjectFormState } from "@/components/new-project/utils";

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
  const [projectType, setProjectType] = useState<ProjectMode | null>(null);
  const [templateType, setTemplateType] = useState<TemplateType | null>(null);
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
                    setIsImporting(false);
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
                    className="cursor-pointer h-auto p-2"
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
                    className="cursor-pointer h-auto p-2"
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
                    className="cursor-pointer h-auto p-2"
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
