import { readFileSync, writeFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY || "luizgsrocha/boaestrada";
const sha = process.env.GITHUB_SHA;
const token = process.env.GH_TOKEN;
if (!sha || !token) throw new Error("GITHUB_SHA and GH_TOKEN are required");

const url = `https://api.github.com/repos/${repo}/commits/${sha}/pulls`;
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});
if (!response.ok) throw new Error(`Cannot resolve release PR: ${response.status}`);
const prs = await response.json();
const pr = prs.find((item) => item.merged_at && item.base?.ref === "main");
const label = pr ? `PR #${pr.number}` : `commit ${sha.slice(0, 8)}`;
const href = pr ? `https://github.com/${repo}/pull/${pr.number}` : `https://github.com/${repo}/commit/${sha}`;

const path = "src/worker.ts";
const source = readFileSync(path, "utf8");
const pattern = /<a href="https:\/\/github\.com\/luizgsrocha\/boaestrada\/pull\/20" style="color:inherit;text-decoration:underline" title="PR desta versão do Worker">PR #20<\/a>/;
if (!pattern.test(source)) throw new Error("Release marker not found in served Worker HTML");
const stamped = source.replace(pattern, `<a href="${href}" style="color:inherit;text-decoration:underline" title="Versão publicada: ${sha}">${label}</a> · commit ${sha.slice(0, 8)}`);
writeFileSync(path, stamped);
console.log(`Release metadata: ${label} (${sha.slice(0, 8)})`);
