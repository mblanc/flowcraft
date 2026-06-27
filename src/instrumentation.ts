export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const { config } = await import("@/lib/config");
    const exporterType = config.OTEL_EXPORTER;

    console.log(`[OTel] register() called, exporter=${exporterType}`);

    if (exporterType === "none") return;

    if (exporterType === "cloud_trace") {
        try {
            const { maybeSetOtelProviders, getGcpExporters, getGcpResource } =
                await import("@google/adk");
            const hooks = await getGcpExporters();
            maybeSetOtelProviders([hooks], getGcpResource());
            console.log("[OTel] Cloud Trace provider registered successfully");
        } catch (err) {
            console.error(
                "[OTel] Failed to initialize Cloud Trace exporter:",
                err,
            );
        }
        return;
    }

    if (exporterType === "langfuse") {
        try {
            const { maybeSetOtelProviders } = await import("@google/adk");
            const { OTLPTraceExporter } =
                await import("@opentelemetry/exporter-trace-otlp-http");
            const { SimpleSpanProcessor } =
                await import("@opentelemetry/sdk-trace-base");
            const { resourceFromAttributes } =
                await import("@opentelemetry/resources");

            const authHeader = Buffer.from(
                `${config.LANGFUSE_PUBLIC_KEY}:${config.LANGFUSE_SECRET_KEY}`,
            ).toString("base64");

            const langfuseExporter = new OTLPTraceExporter({
                url: `${config.LANGFUSE_HOST}/api/public/otel/v1/traces`,
                headers: { Authorization: `Basic ${authHeader}` },
            });

            maybeSetOtelProviders(
                [
                    {
                        spanProcessors: [
                            new SimpleSpanProcessor(langfuseExporter),
                        ],
                    },
                ],
                resourceFromAttributes({
                    "service.name": "flowcraft-canvas-agent",
                }),
            );
            console.log("[OTel] Langfuse provider registered successfully");
        } catch (err) {
            console.error(
                "[OTel] Failed to initialize Langfuse exporter:",
                err,
            );
        }
    }
}
