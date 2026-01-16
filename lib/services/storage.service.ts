import {
    uploadImage,
    uploadFile,
    getSignedUrlFromGCS,
    getMimeTypeFromGCS,
    gcsUriToSharp,
    gcsUriToBase64,
} from "../storage";
import { v4 as uuidv4 } from "uuid";

export class StorageService {
    async uploadImage(
        base64: string,
        filename: string,
    ): Promise<string | null> {
        return uploadImage(base64, filename);
    }

    async uploadFile(
        buffer: Buffer,
        filename: string,
        contentType: string,
    ): Promise<string | null> {
        return uploadFile(buffer, filename, contentType);
    }

    async getSignedUrl(
        gcsUri: string,
        download: boolean = false,
    ): Promise<string> {
        return getSignedUrlFromGCS(gcsUri, download);
    }

    async getMimeType(gcsUri: string): Promise<string | null> {
        return getMimeTypeFromGCS(gcsUri);
    }

    async gcsUriToSharp(gcsUri: string) {
        return gcsUriToSharp(gcsUri);
    }

    async gcsUriToBase64(gcsUri: string): Promise<string> {
        return gcsUriToBase64(gcsUri);
    }

    async resizeImage(
        gcsUri: string,
        width: number,
        height: number,
    ): Promise<string | null> {
        const sharpInstance = await this.gcsUriToSharp(gcsUri);
        const resizedBuffer = await sharpInstance
            .resize(width, height, { fit: "cover", position: "center" })
            .png()
            .toBuffer();

        const filename = `resized-${uuidv4()}.png`;
        return this.uploadFile(resizedBuffer, filename, "image/png");
    }
}

export const storageService = new StorageService();
