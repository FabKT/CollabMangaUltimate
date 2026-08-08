function extensionForBlob(blob: Blob) {
  if (blob.type === "image/jpeg") return "jpg";
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "image/gif") return "gif";
  if (blob.type === "image/avif") return "avif";
  return "png";
}

function filenameForBlob(filename: string, blob: Blob) {
  const extension = extensionForBlob(blob);
  return /\.(?:png|jpe?g|webp|gif|avif)$/i.test(filename)
    ? filename.replace(/\.(?:png|jpe?g|webp|gif|avif)$/i, `.${extension}`)
    : `${filename}.${extension}`;
}

function clickDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Downloads data URLs and remote AI/Supabase images consistently. */
export async function downloadImageAsset(source: string, filename: string) {
  if (!source) throw new Error("No image is available to download.");

  try {
    const response = await fetch(source, {
      credentials: "omit",
      mode: "cors",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Image download failed (${response.status}).`);

    const blob = await response.blob();
    if (!blob.size) throw new Error("The downloaded image is empty.");

    const objectUrl = URL.createObjectURL(blob);
    clickDownload(objectUrl, filenameForBlob(filename, blob));
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch (error) {
    clickDownload(source, filename);
    if (source.startsWith("blob:")) throw error;
  }
}
