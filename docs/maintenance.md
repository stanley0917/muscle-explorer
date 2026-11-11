# 维护说明

## 修改位置

`js/data.js` 是动作、肌群元数据和资源路径的唯一来源。保持动作及肌群 ID 稳定；名称、步骤、用途和主辅关系均在这里修改，不要直接编辑生成的单文件网页。

`js/model.js` 负责动作与肌群的双向查询、胸肌父子关系及搜索。`js/anatomy.js` 负责轮廓、标签和局部剖示坐标，并为肌群补充几何信息。`js/app.js` 负责页面渲染、悬停、固定、键盘操作和分享入口；`js/download.js` 提供两种分享方式共用的 ZIP 算法。

浏览器按 data、model、anatomy、download、app 的顺序加载普通脚本。图片使用相对路径，不依赖运行时网络请求。保留这种加载方式才能继续直接双击 HTML 使用。

## 分享版

在项目根目录执行 `node scripts/build-share.cjs`。脚本读取首页、CSS、JS 和图片，内嵌到一个 HTML 中，再生成包含该 HTML 和办公室方案 PNG 的 ZIP。只使用 Node.js 内置模块，无需 npm install。

规范版通过本地链接下载 `dist` 中的 ZIP；单文件版使用内嵌图片和 ZIP 函数动态打包。打包前会清除临时搜索、选中状态和已渲染内容，使分享出去的网页从初始状态打开。成功后不显示额外提示，失败时保留错误提示。

## 验证与内容基准

执行 `node --test tests/*.test.cjs`。内容基准保存的是确认版动作和肌群数据的 SHA-256，不维护第二份业务数据。测试覆盖数据完整性、主辅映射、胸肌层级、搜索和 ZIP 内容。未来明确修改训练内容时，应审核变更后再更新基准。

浏览器验证使用 `tests/browser-check.cjs`，需在外部工具环境提供 Playwright，并设置 `PLAYWRIGHT_MODULE` 为其模块入口路径；可用 `BROWSER_EXECUTABLE` 指定 Chromium 系浏览器。执行 `node tests/browser-check.cjs`，结果保存到 Git 忽略的 `local/verification/`。该工具不作为网页运行依赖。

检查规范版和单文件版在 1920×1080、1920×960、1000×800 下的显示，以及动作、肌肉反查、深层图、搜索、固定、辅助开关和键盘操作。下载 ZIP 后校验中文文件名、CRC、图片字节，并打开解压后的网页再次分享。旧 QA JSON 只是历史记录，不代替当前浏览器验证。

## 资源与本地归档

`assets/images/anatomy.webp` 是正背面底图，`deep-anatomy.webp` 是深层剖示底图，两者来自原版图像生成过程。网页使用无损 WebP 减少下载量，原始 PNG 保留在 Git 历史和本机历史归档中。办公室方案 PNG 沿用原版分享附件；本项目不维护该方案的 PDF 或生成脚本。

WebP 转换保持原始尺寸，不缩放、不调色；使用 Pillow 的 `lossless=True, quality=100, method=6, exact=True` 参数。这里的 quality 参数控制无损压缩的计算投入，不表示有损画质。转换后将原图与输出解码为 RGBA，逐字节核验像素一致。本机的 `local/verification/webp-lossless.json` 记录体积、哈希及核验结果。分享构建按扩展名写入正确的图片 MIME 类型，办公室 PNG 附件格式保持不变。

本机的 `local/archive/2026-11-10/` 完整保存整理前的图谱目录；`local/reference/` 保存早期两张肌肉示意图及提示词。迁移文件清单与 SHA-256 位于 `local/migration-manifest.json`。这些文件不属于公开仓库，克隆项目无需拥有它们。

Git 根目录仅为本项目目录。提交前检查 `git status --short` 和 `git status --short --ignored`，确保本地归档、生成包、缓存及环境配置没有进入提交范围。图片和项目内容如需采用开源许可证，由作者另行决定。
