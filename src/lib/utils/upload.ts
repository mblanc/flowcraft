export interface UploadResult {
    gcsUri: string;
    signedUrl: string;
}

export async function uploadFile(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload-file", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json() as Promise<UploadResult>;
}
