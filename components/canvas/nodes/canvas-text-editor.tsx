"use client";
import "@mdxeditor/editor/style.css";
import {
    MDXEditor,
    headingsPlugin,
    listsPlugin,
    quotePlugin,
    thematicBreakPlugin,
    markdownShortcutPlugin,
} from "@mdxeditor/editor";
import { useTheme } from "next-themes";

interface Props {
    markdown: string;
    onChange: (markdown: string) => void;
}

export function CanvasTextEditor({ markdown, onChange }: Props) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    return (
        <MDXEditor
            markdown={markdown}
            onChange={onChange}
            className={isDark ? "dark-theme dark-editor" : ""}
            plugins={[
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                thematicBreakPlugin(),
                markdownShortcutPlugin(),
            ]}
        />
    );
}
