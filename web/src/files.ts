// Browser file helpers: downloads and image import. Nothing is uploaded anywhere.

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A safe file name stem for a deck title. */
export function fileStem(title: string): string {
  return title.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "deck";
}

const MAX_SIDE = 1920;

/** Read an image file, scaled down to at most 1920px on its long side, as a data: URL. */
export async function imageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  // SVG and GIF keep their own format (vector / animation).
  if (file.type === "image/svg+xml" || file.type === "image/gif") return readAsDataUrl(file);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image could not be read.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // PNG keeps transparency; photos become WebP to stay small.
  const type = file.type === "image/png" && scale === 1 ? "image/png" : "image/webp";
  return canvas.toDataURL(type, 0.86);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This file could not be read."));
    reader.readAsDataURL(file);
  });
}
