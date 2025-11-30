"use client"

import type React from "react"

import { memo, useRef } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { FileData } from "@/lib/types"
import { FileUp, ImageIcon, Video } from "lucide-react"
import { useFlow } from "./flow-provider"
import Image from "next/image"

export const FileNode = memo(({ data, selected, id }: NodeProps<Node<FileData>>) => {
  const { updateNodeData } = useFlow()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null

    if (!fileType) {
      alert("Please upload an image or video file")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/upload-file", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const data = await response.json()

      updateNodeData(id, {
        fileUrl: data.signedUrl,
        gcsUri: data.gcsUri,
        fileName: file.name,
        fileType,
      })
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload file")
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      className={`bg-card border-2 rounded-lg p-4 min-w-[220px] shadow-lg transition-all ${selected ? "border-primary shadow-primary/20" : "border-border"
        }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-cyan-500/10 flex items-center justify-center">
          <FileUp className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="flex-1 min-w-0 text-left">
          <h3 className="font-semibold text-foreground text-sm mb-1 truncate">{data.name}</h3>
          <div className="text-xs text-muted-foreground">
            {data.fileName ? (
              <span className="flex items-center gap-1">
                {data.fileType === "image" ? (
                  <ImageIcon className="h-3 w-3" />
                ) : data.fileType === "video" ? (
                  <Video className="h-3 w-3" />
                ) : null}
                {data.fileName}
              </span>
            ) : (
              "No file uploaded"
            )}
          </div>
        </div>
      </div>

      {data.fileUrl && (
        <div className="mt-3 rounded-md overflow-hidden border border-border">
          {data.fileType === "image" ? (
            <Image
              src={data.fileUrl || "/placeholder.svg"}
              alt={data.fileName}
              width={200}
              height={150}
              className="w-full h-auto object-contain max-h-[300px]"
            />
          ) : data.fileType === "video" ? (
            <video src={data.fileUrl} controls className="w-full h-auto max-h-[300px]" />
          ) : null}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />

      <button
        onClick={handleUploadClick}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-md text-xs font-medium transition-colors"
      >
        <FileUp className="h-3 w-3" />
        {data.fileUrl ? "Change File" : "Upload File"}
      </button>

      <Handle type="source" position={Position.Right} className="!bg-cyan-500" />
    </div>
  )
})

FileNode.displayName = "FileNode"
