Great question. Let me break this down comprehensively.

---

## The Overall Architecture

You want an **AI agent** that reads your codebase and maintains a **Nextra documentation site** that stays in sync with your repo. Here's how to think about it:

---

## 1. Where to Put the Docs

**Same repo, separate directory** is the standard approach — specifically a `/docs` folder at the root:

```
your-nextjs-app/
├── src/                  # your app
├── docs/                 # Nextra doc site
│   ├── pages/
│   │   ├── index.mdx
│   │   ├── getting-started.mdx
│   │   └── api/
│   ├── next.config.js
│   ├── package.json
│   └── theme.config.tsx
├── package.json          # your app's package.json
└── ...
```

**Why same repo?** The agent reads your source code and writes MDX files — keeping everything co-located means a single PR can update both code and docs atomically. No cross-repo sync headaches.

---

## 2. Setting Up the Nextra Doc Site

Inside `/docs`:

```bash
cd docs
npm init -y
npm install next nextra nextra-theme-docs react react-dom
```

`docs/next.config.js`:

```js
const withNextra = require("nextra")({
    theme: "nextra-theme-docs",
    themeConfig: "./theme.config.tsx",
});
module.exports = withNextra();
```

`docs/theme.config.tsx`:

```tsx
export default {
    logo: <span>My App Docs</span>,
    project: { link: "https://github.com/you/your-repo" },
    docsRepositoryBase: "https://github.com/you/your-repo/tree/main/docs",
    footer: { text: "Auto-maintained by AI agent" },
};
```

---

## 3. The Agent — How It Works

The agent is a script (Node.js or Python) that:

1. **Reads** your source code (scans `/src`, reads files, extracts exports, comments, types)
2. **Calls Claude** (or another LLM) with the code context and asks it to write/update MDX documentation
3. **Writes** the resulting MDX into `docs/pages/`
4. **Commits** the changes via git

A minimal Node.js agent (`scripts/doc-agent.js`):

```js
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const client = new Anthropic();

// 1. Collect source files
function collectSource(dir, extensions = [".ts", ".tsx"]) {
    const results = [];
    for (const file of fs.readdirSync(dir, { recursive: true })) {
        if (extensions.some((ext) => file.endsWith(ext))) {
            const fullPath = path.join(dir, file);
            results.push({
                path: file,
                content: fs.readFileSync(fullPath, "utf8"),
            });
        }
    }
    return results;
}

// 2. Ask Claude to generate/update a doc page
async function generateDocPage(sourceFiles, pageName) {
    const sourceContext = sourceFiles
        .map((f) => `### ${f.path}\n\`\`\`ts\n${f.content}\n\`\`\``)
        .join("\n\n");

    const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
            {
                role: "user",
                content: `You are a technical writer. Based on the following source code, write a Nextra MDX documentation page for "${pageName}". 
Use proper MDX with frontmatter, headings, code examples, and callouts. Be accurate — only document what exists in the code.

${sourceContext}

Output only the MDX content, no preamble.`,
            },
        ],
    });

    return message.content[0].text;
}

// 3. Write and commit
async function run() {
    const files = collectSource("./src");
    const mdx = await generateDocPage(files, "API Reference");

    fs.writeFileSync("./docs/pages/api-reference.mdx", mdx);

    execSync('git add docs/ && git commit -m "docs: auto-update via agent"');
    console.log("Docs updated and committed.");
}

run();
```

---

## 4. When to Run the Agent

**Option A — GitHub Actions (recommended)**

Trigger on every push to `main`:

```yaml
# .github/workflows/update-docs.yml
name: Update Docs

on:
    push:
        branches: [main]
        paths:
            - "src/**" # only when source changes

jobs:
    update-docs:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
              with:
                  token: ${{ secrets.GITHUB_TOKEN }}

            - uses: actions/setup-node@v4
              with: { node-version: 20 }

            - run: npm install @anthropic-ai/sdk

            - run: node scripts/doc-agent.js
              env:
                  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

            - name: Push updated docs
              run: |
                  git config user.name "doc-agent[bot]"
                  git config user.email "doc-agent@noreply"
                  git diff --quiet || git push
```

**Option B — PR-triggered** — run the agent when a PR is opened, post the generated docs as a comment or push to the branch.

**Option C — Scheduled** — run nightly via `on: schedule: cron`.

---

## 5. Publishing the Docs

### Option A — Vercel (easiest, best fit since it's Next.js)

1. Go to [vercel.com](https://vercel.com) → New Project → import your repo
2. Set **Root Directory** to `docs`
3. Vercel auto-detects Next.js and deploys on every push

You get: `https://your-docs.vercel.app` — or set a custom domain like `docs.yourapp.com`.

### Option B — GitHub Pages

In `/docs/package.json` add:

```json
"scripts": {
  "export": "next build && next export -o out"
}
```

Then deploy `out/` to GitHub Pages via Actions. Works but static export has limitations with Nextra's search.

### Option C — Self-hosted

Run `npm run build && npm start` in `/docs` on your own VPS/container. Fine if you already have infra.

**Vercel is the recommended path** — zero config, preview deployments per PR, CDN, and the docs update automatically when the agent commits.

---

## 6. The Full Flow End-to-End

```
Developer pushes code to main
        ↓
GitHub Actions triggers update-docs.yml
        ↓
doc-agent.js reads /src, calls Claude API
        ↓
Claude generates/updates MDX in /docs/pages/
        ↓
Agent commits "docs: auto-update" to main
        ↓
Vercel detects new commit → rebuilds docs site
        ↓
docs.yourapp.com updated within ~60 seconds
```

---

## 7. Making the Agent Smarter

A few things worth adding as you iterate:

- **Diff-aware updates** — only regenerate pages for files that actually changed (use `git diff` to scope what the agent processes)
- **Section mapping** — map source directories to doc sections (`src/components/` → `docs/pages/components/`, `src/api/` → `docs/pages/api/`)
- **`_meta.json` management** — have the agent also maintain Nextra's sidebar config
- **Doc review PR** — instead of committing directly to main, open a PR so a human can review the generated docs before publish

---
