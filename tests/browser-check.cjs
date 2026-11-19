// Optional browser regression runner; Playwright is supplied by the tool environment.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");
const { crc32 } = require("../js/download.js");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "local/verification");

async function unpack(filename, directory) {
  const zip = await fs.readFile(filename);
  let offset = 0;
  const names = [];
  await fs.mkdir(directory, { recursive: true });
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 6), 0x0800);
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    const size = zip.readUInt32LE(offset + 18);
    const length = zip.readUInt16LE(offset + 26);
    const extra = zip.readUInt16LE(offset + 28);
    const name = zip
      .subarray(offset + 30, offset + 30 + length)
      .toString("utf8");
    assert.ok(["训练肌肉图谱.html", "办公室碎片化运动方案.png"].includes(name));
    const start = offset + 30 + length + extra;
    const data = zip.subarray(start, start + size);
    assert.equal(crc32(data), zip.readUInt32LE(offset + 14));
    await fs.writeFile(path.join(directory, name), data);
    names.push(name);
    offset = start + size;
  }
  assert.equal(names.length, 2);
  assert.deepEqual(
    await fs.readFile(path.join(directory, "办公室碎片化运动方案.png")),
    await fs.readFile(
      path.join(root, "assets/images/办公室碎片化运动方案.png"),
    ),
  );
  return path.join(directory, "训练肌肉图谱.html");
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  execFileSync(process.execPath, [path.join(root, "scripts/build-share.cjs")]);
  const browser = await chromium.launch({
    headless: true,
    downloadsPath: output,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
  const report = { date: new Date().toISOString(), editions: [] };
  try {
    for (const [edition, filename] of [
      ["source", "index.html"],
      ["portable", "dist/训练肌肉图谱.html"],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        acceptDownloads: true,
        offline: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("requestfailed", (request) => {
        // Chromium cancels navigation when a local ZIP becomes a download.
        if (
          request.url().endsWith(".zip") &&
          request.failure()?.errorText === "net::ERR_ABORTED"
        ) return;
        errors.push(request.url() + ": " + request.failure()?.errorText);
      });
      await page.goto(pathToFileURL(path.join(root, filename)).href);
      await page.locator(".exercise-btn").first().waitFor();
      assert.equal(await page.locator(".exercise-btn").count(), 26);
      assert.equal(await page.locator("#count").textContent(), "26 个动作");
      const layouts = [];
      for (const [width, height] of [
        [1920, 1080],
        [1920, 960],
        [1000, 800],
      ]) {
        await page.setViewportSize({ width, height });
        const layout = await page.evaluate(() => {
          const box = (selector) => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right };
          };
          const catalog = document.querySelector(".catalog");
          const list = document.querySelector("#exercise-list");
          return {
            catalog: box(".catalog"),
            atlas: box(".atlas"),
            details: box(".details"),
            scroll: Math.max(
              catalog.scrollHeight - catalog.clientHeight,
              list.scrollHeight - list.clientHeight,
            ),
          };
        });
        assert.ok(
          layout.catalog.x < layout.atlas.x &&
            layout.atlas.x < layout.details.x,
        );
        assert.ok(Math.abs(layout.catalog.y - layout.details.y) < 2);
        assert.ok(
          layout.details.right - layout.details.x >
            layout.catalog.right - layout.catalog.x,
        );
        if (width === 1920)
          assert.ok(layout.scroll <= 1, JSON.stringify(layout));
        layouts.push({ width, height, ...layout });
        await page.screenshot({
          path: path.join(output, `${edition}-${width}x${height}.png`),
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 1920, height: 1080 });
      // Check the rendered muscle highlights and illustration for every exercise.
      const mappings = await page.evaluate(async () => {
        const results = [];
        for (const exercise of EXERCISES) {
          document
            .querySelector(`[data-kind="exercise"][data-id="${exercise.id}"]`)
            .click();
          const actual = [
            ...new Set(
              [...document.querySelectorAll("[data-muscle].is-primary")].map(
                (el) => el.dataset.muscle,
              ),
            ),
          ].sort();
          const image = document.querySelector(".exercise-illustration img");
          await image.decode();
          const { width, height } = image.getBoundingClientRect();
          results.push({
            id: exercise.id,
            title: document.querySelector("#detail-title").textContent,
            expectedTitle: exercise.name,
            actual,
            expected: Object.keys(model.exerciseRoles(exercise, false)).sort(),
            illustrationMatches:
              image.getAttribute("src") === ASSETS[exercise.illustration.asset] &&
              image.alt === exercise.illustration.alt,
            illustrationSize: [image.naturalWidth, image.naturalHeight, width, height],
          });
        }
        return results;
      });
      for (const result of mappings) {
        assert.equal(result.title, result.expectedTitle);
        assert.deepEqual(result.actual, result.expected);
        assert.ok(result.illustrationMatches, result.title);
        assert.deepEqual(result.illustrationSize, [320, 160, 320, 160], result.title);
      }
      await page.keyboard.press("Escape");
      const reverse = await page.evaluate(() =>
        Object.keys(MUSCLES).map((id) => {
          document
            .querySelector(`[data-kind="muscle"][data-id="${id}"]`)
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
          return {
            id,
            title: document.querySelector("#detail-title").textContent,
            expectedTitle: MUSCLES[id].name,
            actual: [...document.querySelectorAll("[data-pick]")]
              .map((el) => el.dataset.pick)
              .sort(),
            expected: model.reverse[id].primary.map((e) => e.id).sort(),
          };
        }),
      );
      for (const result of reverse) {
        assert.equal(result.title, result.expectedTitle);
        assert.deepEqual(result.actual, result.expected);
      }
      await page.keyboard.press("Escape");
      await page.locator(".exercise-btn").first().hover();
      assert.equal(
        await page.locator("#detail-title").textContent(),
        "平板哑铃卧推",
      );
      const illustration = page.locator(".exercise-illustration img");
      await page.locator(".details").screenshot({
        path: path.join(output, `${edition}-flat-dumbbell-bench-press.png`),
      });
      await page.locator(".exercise-btn").first().click();
      await page.locator(".exercise-btn").nth(1).hover();
      assert.equal(
        await page.locator("#detail-title").textContent(),
        "弹力带高位下拉",
      );
      assert.match(await illustration.getAttribute("alt"), /^弹力带高位下拉/);
      await illustration.evaluate((img) => img.decode());
      await page.locator(".details").screenshot({
        path: path.join(output, `${edition}-resistance-band-lat-pulldown.png`),
      });
      await page.locator('.exercise-btn[data-id="e6"]').hover();
      assert.match(await illustration.getAttribute("alt"), /^引体向上/);
      await page.locator('.exercise-btn[data-id="e3"]').hover();
      assert.equal(await page.locator("#detail-title").textContent(), "哑铃夹胸");
      await illustration.evaluate((img) => img.decode());
      await page.locator(".details").screenshot({
        path: path.join(output, `${edition}-dumbbell-chest-fly.png`),
      });
      await page.locator(".masthead").hover();
      await page.waitForTimeout(300);
      assert.equal(
        await page.locator("#detail-title").textContent(),
        "平板哑铃卧推",
      );
      await page.locator("#secondary-toggle").check();
      assert.ok((await page.locator("[data-muscle].is-secondary").count()) > 0);
      await page.locator("#secondary-toggle").uncheck();
      await page.keyboard.press("Escape");
      await page.locator("#search").fill("肱三头肌");
      assert.ok((await page.locator(".exercise-btn").count()) > 0);
      await page.locator("#search").fill("不存在动作");
      assert.equal(await page.locator(".exercise-btn").count(), 0);
      await page.locator("#clear-search").click();
      assert.equal(await page.locator(".exercise-btn").count(), 26);
      await page.locator(".exercise-btn").first().focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await page.locator(":focus").getAttribute("data-id"), "e7");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#unpin").isVisible(), true);
      await page.keyboard.press("Escape");
      await page.locator('.deep-card[data-id="brachialis"]').click();
      assert.equal(await page.locator(".detail-cutaway").count(), 1);
      await page.locator('.exercise-btn[data-id="e24"]').click();
      assert.deepEqual(
        await page.locator(".training-plan dd").allTextContents(),
        ["3 组 × 15–20 次", "1 组 × 15–25 次，保持轻松"],
      );
      await page.screenshot({
        path: path.join(output, `${edition}-training-reference.png`),
        fullPage: true,
      });
      // Load SVG image sources explicitly too, detecting broken file paths in offline mode.
      assert.equal(
        await page.evaluate(async () => {
          const results = await Promise.all(
            Object.values(ASSETS).map(
              (src) =>
                new Promise((resolve) => {
                  const image = new Image();
                  image.onload = () => resolve(image.naturalWidth > 0);
                  image.onerror = () => resolve(false);
                  image.src = src;
                }),
            ),
          );
          return results.every(Boolean);
        }),
        true,
      );
      await page.keyboard.press("Escape");
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#download-source").click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), "训练肌肉图谱.zip");
      const saved = path.join(output, `${edition}-download.zip`);
      await download.saveAs(saved);
      assert.equal(await page.locator("#download-status").textContent(), "");
      const extracted = await unpack(
        saved,
        path.join(output, `${edition}-unpacked`),
      );
      await page.goto(pathToFileURL(extracted).href);
      assert.equal(await page.locator(".exercise-btn").count(), 26);
      const illustratedExercises = await page.evaluate(() =>
        EXERCISES.filter((e) => e.illustration).map((e) => e.id),
      );
      for (const id of illustratedExercises) {
        await page.locator(`.exercise-btn[data-id="${id}"]`).click();
        await illustration.evaluate((img) => img.decode());
      }
      const againPromise = page.waitForEvent("download");
      await page.locator("#download-source").click();
      const again = await againPromise;
      const againPath = path.join(output, `${edition}-reshared.zip`);
      await again.saveAs(againPath);
      await unpack(againPath, path.join(output, `${edition}-reshared`));
      assert.deepEqual(errors, []);
      report.editions.push({
        edition,
        layouts,
        actions: mappings.length,
        illustrations: mappings.length,
        muscles: reverse.length,
        errors,
        download: "passed",
        reshare: "passed",
      });
      await context.close();
    }
    await fs.writeFile(
      path.join(output, "browser-results.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
