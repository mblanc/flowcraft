"use client";

import { CanvasChatMessages } from "./canvas-chat-messages";
import { CanvasChatInput } from "./canvas-chat-input";

export function CanvasChatPanel() {
    return (
        <div className="border-border bg-card flex w-[380px] shrink-0 flex-col border-l">
            <div className="border-border flex h-12 items-center border-b px-4">
                <h2 className="text-foreground text-sm font-semibold">Chat</h2>
            </div>
            <CanvasChatMessages />
            <CanvasChatInput />
        </div>
    );
}
