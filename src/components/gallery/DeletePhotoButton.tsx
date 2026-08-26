"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGalleryPhoto } from "@/app/(dashboard)/gallery/actions";

export function DeletePhotoButton({ photoId }: { photoId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this photo?")) return;
    setPending(true);
    const fd = new FormData();
    fd.set("photo_id", photoId);
    await deleteGalleryPhoto(fd);
    setPending(false);
    router.refresh();
  }

  return (
    <button onClick={handleDelete} disabled={pending} className="mt-1 text-xs text-red-500 hover:underline">
      Delete
    </button>
  );
}
