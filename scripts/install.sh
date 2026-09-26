#!/usr/bin/env bash
set -euo pipefail

for tool in node npm git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '请先安装 Node.js 20+（含 npm）和 Git，缺少命令：%s\n' "$tool" >&2
    exit 1
  fi
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("需要 Node.js 20+"); process.exit(1); }'

njucli_work=$(mktemp -d "${TMPDIR:-/tmp}/njucli-install.XXXXXX")
trap 'rm -rf "$njucli_work"' EXIT
git clone --quiet --depth 1 --branch main https://github.com/MarcWebber/njucli.git "$njucli_work/source"

cd "$njucli_work/source"
njucli_manager=$(node -p 'require("./package.json").packageManager')
npm exec --yes --package "$njucli_manager" -- pnpm install --frozen-lockfile --ignore-scripts
npm exec --yes --package "$njucli_manager" -- pnpm build
npm pack --ignore-scripts --pack-destination "$njucli_work" --json > "$njucli_work/pack.json"
njucli_tarball=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[0].filename' "$njucli_work/pack.json")

# 在临时源码移除前切离目录，安装产物使用独立的全局包目录。
cd "$njucli_work"
njucli_options=(--global --foreground-scripts)
if [ -n "${NJUCLI_INSTALL_PREFIX:-}" ]; then
  njucli_options+=(--prefix "$NJUCLI_INSTALL_PREFIX")
fi
npm install "${njucli_options[@]}" "$njucli_work/$njucli_tarball"
printf '\n安装完成，可运行 njucli --help；升级使用 njucli upgrade。\n'
