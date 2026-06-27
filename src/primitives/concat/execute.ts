import { concatService } from "@/lib/services/concat.service";

type ConcatRequest = {
    inputUris: string[];
    label?: string;
    prompt?: string;
    dependsOn?: string[];
};
type ConcatResult = { videoUrl: string };

export async function concatExecute(
    inputs: ConcatRequest,
    _ctx: { userId: string },
): Promise<ConcatResult> {
    if (inputs.inputUris.length === 0) {
        throw new Error(
            `Concat step has no resolved input URIs — all dependsOn steps must complete first`,
        );
    }
    const videoUrl = await concatService.concatVideos(inputs.inputUris);
    return { videoUrl };
}
