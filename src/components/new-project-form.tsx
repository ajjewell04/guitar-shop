"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: map templateType/file to your real IDs
      const body = {
        name: projectName.trim(),
        mode: projectType ?? "blank",
        // templateId: templateType ? "uuid-for-selected-template" : undefined,
        // importAssetId: file ? "uuid-for-uploaded-asset" : undefined,
      };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Create failed");
      }

      // success: data = { id, root_node_id }
      console.log("Created project:", data);
      onSuccess?.();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
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
                ></Input>
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
                  onClick={() => setProjectType("import")}
                >
                  Import
                </Button>
                <Button
                  type="button"
                  variant={projectType === "template" ? "secondary" : "outline"}
                  onClick={() => setProjectType("template")}
                >
                  Template
                </Button>
              </div>
              {projectType === "blank" && (
                <div className="mt-4 flex flex-col gap-2"></div>
              )}
              {projectType === "import" && (
                <div className="mt-4 flex gap-2">
                  <Label htmlFor="filename">File: </Label>
                  <input
                    id="filename"
                    type="file"
                    className="text-sm"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  ></input>
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
