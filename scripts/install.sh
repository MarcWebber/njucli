#!/usr/bin/env bash
set -euo pipefail

njucli_skill=
if [ "$#" -gt 0 ]; then
  case "$1" in
    --help|-h)
      printf '用法：install.sh [--skill <名称>]\n示例：install.sh --skill box\n'
      exit 0
      ;;
    --skill)
      if [ "$#" -ne 2 ] || [[ ! "${2#njucli-}" =~ ^[a-z][a-z0-9-]*$ ]]; then
        printf '请指定 Skill 名称，例如：--skill box\n' >&2
        exit 1
      fi
      njucli_skill="njucli-${2#njucli-}"
      ;;
    *)
      printf '未知参数：%s；用法：install.sh [--skill <名称>]\n' "$1" >&2
      exit 1
      ;;
  esac
fi

for tool in node npm git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf '请先安装 Node.js 20+（含 npm）和 Git，缺少命令：%s\n' "$tool" >&2
    exit 1
  fi
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("需要 Node.js 20+"); process.exit(1); }'

njucli_work=$(mktemp -d "${TMPDIR:-/tmp}/njucli-install.XXXXXX")
trap 'rm -rf "$njucli_work"' EXIT
git -c credential.helper= clone --quiet --depth 1 --branch main https://github.com/MarcWebber/njucli.git "$njucli_work/source"

cd "$njucli_work/source"
if [ -n "$njucli_skill" ] && [ ! -f "skills/$njucli_skill/SKILL.md" ]; then
  printf '未找到 Skill：%s\n' "$njucli_skill" >&2
  exit 1
fi
njucli_manager=$(node -p 'require("./package.json").packageManager')
npm exec --yes --package "$njucli_manager" -- pnpm install --frozen-lockfile --ignore-scripts
npm exec --yes --package "$njucli_manager" -- pnpm build
if [ -n "$njucli_skill" ]; then
  cd "skills/$njucli_skill"
fi
npm pack --ignore-scripts --pack-destination "$njucli_work" --json > "$njucli_work/pack.json"
njucli_tarball=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[0].filename' "$njucli_work/pack.json")

# 在临时源码移除前切离目录，安装产物使用独立的全局包目录。
cd "$njucli_work"
njucli_options=(--global)
if [ -n "${NJUCLI_INSTALL_PREFIX:-}" ]; then
  njucli_options+=(--prefix "$NJUCLI_INSTALL_PREFIX")
fi
npm install "${njucli_options[@]}" --foreground-scripts "$njucli_work/$njucli_tarball"
if [ -n "$njucli_skill" ]; then
  njucli_packages=$(npm root "${njucli_options[@]}")
  node "$njucli_work/source/scripts/install-skills.mjs" "$njucli_packages/$njucli_skill" "$njucli_skill"
  printf '\n已安装 %s。再次运行此命令即可更新。\n' "$njucli_skill"
else
  printf '\n安装完成，可运行 njucli --help；升级使用 njucli upgrade。\n'
fi
