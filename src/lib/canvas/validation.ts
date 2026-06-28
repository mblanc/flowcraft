import logger from "@/app/logger";
import { MODELS } from "@/lib/constants";
import { geminiService } from "@/lib/services/gemini.service";
import type { RulesetDocument } from "@/lib/services/ruleset.service";
import type { ValidationResult } from "./types";

const VALIDATION_SYSTEM_PROMPT = `You are a media validation assistant. You will receive an image and a list of rules.
For each rule, respond with exactly:
RULE <id>: PASS | FAIL — <one sentence reason>
Do not add any other text.`;

function formatRuleList(rules: RulesetDocument["rules"]): string {
    return rules
        .map((r) => `Rule ${r.id}: ${r.description} [severity: ${r.severity}]`)
        .join("\n");
}

function parseValidationResponse(
    text: string,
    ruleset: RulesetDocument,
): ValidationResult[] {
    const ruleMap = new Map(ruleset.rules.map((r) => [r.id, r]));
    const results: ValidationResult[] = [];
    const lineRegex = /^RULE\s+(\S+):\s+(PASS|FAIL)\s*[—\-–]\s*(.+)$/i;

    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(lineRegex);
        if (!match) continue;

        const [, ruleId, verdict, reason] = match;
        const rule = ruleMap.get(ruleId);
        if (!rule) continue;

        results.push({
            ruleId: rule.id,
            ruleDescription: rule.description,
            severity: rule.severity,
            status: verdict.toUpperCase() === "PASS" ? "pass" : "fail",
            reason: reason.trim(),
        });
    }

    // For any rules not matched in the response, add a fail entry
    for (const rule of ruleset.rules) {
        if (!results.some((r) => r.ruleId === rule.id)) {
            results.push({
                ruleId: rule.id,
                ruleDescription: rule.description,
                severity: rule.severity,
                status: "fail",
                reason: "parse error",
            });
        }
    }

    return results;
}

export async function validateImage(
    imageGcsUri: string,
    ruleset: RulesetDocument,
    mimeType: string = "image/png",
): Promise<ValidationResult[]> {
    if (ruleset.rules.length === 0) return [];

    const ruleListText = formatRuleList(ruleset.rules);

    try {
        const response = await geminiService.generateText({
            model: MODELS.TEXT.GEMINI_3_5_FLASH,
            systemInstruction: VALIDATION_SYSTEM_PROMPT,
            parts: [
                { kind: "uri", uri: imageGcsUri, mimeType },
                { kind: "text", text: ruleListText },
            ],
        });

        return parseValidationResponse(response, ruleset);
    } catch (err) {
        logger.error("[Validation] Gemini validation call failed:", err);
        return ruleset.rules.map((rule) => ({
            ruleId: rule.id,
            ruleDescription: rule.description,
            severity: rule.severity,
            status: "fail" as const,
            reason: "validation service error",
        }));
    }
}
