# dsh-plugins · 插件市场索引

DSH 插件市场索引（format 1）。这个仓库只做一件事：让 `index.json` 始终指向三个插件仓库最新的 Release。

## 别人怎么用

```text
DSH → 插件 → 实验性插件 → 更多 → 自定义插件市场（打开开关）
→ 已安装旁出现「发现」→ 添加索引源
→ https://wstkeqing2677.github.io/dsh-plugins/index.json
```

## 限制（务必先看）

| 项 | 说明 |
|---|---|
| DSH 版本 | 只在 **0.2.1-rc.5** 上验证过；索引里 `engines.dsh: ">=0.2.1-rc.5"` |
| 系统 | 只在 **Windows x64** + Web UI 上验证；**未在 macOS / Linux 测试**（代码是纯 JS、零依赖，很可能能用，但没测过） |
| 版本 | 每个版本**固定到一个 40 位 commit**（format 1 对 Git 源的硬性要求），装的是那个 commit 的检出，不跟随 `main` |
| 分发 | **没有发 npm**，只能从 Git 安装 |
| 界面 | 两个 UI 插件装完必须刷新页面（F5）；`token-thrift` 是宿主侧，装完即生效 |

> 市场里点"安装"会按 `git+…` 真装一遍，**替换掉指向你本地工作区目录的 link 安装**。只是想试的话，先在确认框里核对来源即可，不必真装。

## 自动更新是怎么做到的

format 1 要求 Git 源写死 commit，所以"版本固定"没法去掉；去掉的是**手工维护**：

- `scripts/update-index.mjs`：读 `index.json` 里每个插件的 `repository.url` → 取该仓库 `releases/latest` → 用 `git/ref/tags/<tag>` 拿到 commit → 更新 `version` / `publishTimestamp` / `source.commit`；没变化就什么都不做。
- `.github/workflows/refresh-index.yml`：每天 03:17 UTC、手动 `Run workflow`、以及 push 到 `main` 时各跑一次；有改动才提交，提交后 Pages 自动重新部署。

本地预演（只读，不写文件）：

```sh
cd dsh-plugins
node scripts/update-index.mjs --check
```

## 仓库设置（一次性）

1. `Settings → Pages → Source: Deploy from a branch → main / (root)`。
2. `Settings → Actions → General → Workflow permissions` 选 **Read and write**，否则 Action 无法提交。
3. 确认 `https://wstkeqing2677.github.io/dsh-plugins/index.json` 返回 200 且**不重定向**——索引格式要求如此。

## 发新版时的流程（自动，仅作说明）

1. 插件仓库发 Release，tag 用 `vX.Y.Z`（不要用 `1.0.2` 这种不带 v 的，也不要 prerelease）。
2. 等下一次定时任务，或手动 Run workflow；索引会自己跟上。
3. 不需要改 `index.json`，也不需要重新上传。

## 文件

```
index.json                         市场索引（3 个插件，图标内联）
scripts/update-index.mjs           从最新 Release 刷新索引
.github/workflows/refresh-index.yml 定时 / 手动 / push 触发
```
