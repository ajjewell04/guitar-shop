export async function uploadToSignedUrl(
  url: string,
  contentType: string,
  body: Blob | File,
) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!res.ok) {
    throw new Error("Signed upload failed");
  }
}
