"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";

type ApprovedAssetRow = {
  id: string;
  name: string;
  owner_id: string;
  type: "model" | "material" | "picture";
  part_type:
    | "body"
    | "neck"
    | "headstock"
    | "bridge"
    | "tuning_machine"
    | "pickup"
    | "pickguard"
    | "knob"
    | "switch"
    | "strap_button"
    | "output_jack";
  upload_date: string;
  upload_status: "pending" | "approved" | "rejected";
};

type CommunityLibraryViewProps = React.ComponentPropsWithoutRef<"div">;

export default function CommunityLibraryView({
  className,
}: CommunityLibraryViewProps) {
  const [assets, setAssets] = useState<ApprovedAssetRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUploadedAssets = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, owner_id, part_type, upload_date, upload_status")
        .eq("upload_status", "approved")
        .order("upload_date", { ascending: false });

      if (error) {
        setError("Failed to load assets.");
        setLoading(false);
        setAssets([]);
        return;
      } else {
        setError(null);
        setAssets((data ?? []) as ApprovedAssetRow[]);
      }
      setLoading(false);
    };

    loadUploadedAssets();
  }, []);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {loading && <div>Loading assets...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {!loading && !error && assets.length === 0 && (
        <div>No approved assets found.</div>
      )}
      {!loading && !error && assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="border rounded p-4 flex flex-col items-center"
            >
              <div className="text-lg font-semibold">{asset.name}</div>
              <div className="text-sm text-gray-500">{asset.type}</div>
              <div className="text-sm text-gray-400">
                Uploaded on {new Date(asset.upload_date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
