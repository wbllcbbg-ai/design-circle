"use client"

import { useState, useRef } from "react"

interface ImageUploadProps {
  images: string[]
  onChange: (urls: string[]) => void
  max?: number
}

export function ImageUpload({ images, onChange, max = 9 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    const uploadedUrls: string[] = []

    for (const file of files) {
      if (images.length + uploadedUrls.length >= max) break

      const formData = new FormData()
      formData.append("file", file)

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData })
        const data = await res.json()
        if (data.success) {
          uploadedUrls.push(data.url)
        }
      } catch {}
    }

    onChange([...images, ...uploadedUrls])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((url, i) => (
        <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden relative group bg-zinc-100 dark:bg-zinc-800">
          <img src={url} alt="" className="w-full h-full object-cover" />
          <button
            onClick={() => handleRemove(i)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
          >
            ×
          </button>
        </div>
      ))}
      {images.length < max && (
        <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center cursor-pointer hover:border-zinc-400 transition">
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleSelect} className="hidden" />
          {uploading ? (
            <span className="text-xs text-zinc-400">上传中...</span>
          ) : (
            <svg className="w-6 h-6 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5v14m-7-7h14" />
            </svg>
          )}
        </label>
      )}
    </div>
  )
}
