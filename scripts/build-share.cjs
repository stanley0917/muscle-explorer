// Build the portable edition from the same files used by index.html.
// Requires Node.js 18+; no installed packages or network access needed.
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { zip } = require("../js/download.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFile(path.join(root, name), "utf8");

async function build() {
  let html = await read("index.html");
  const styles = await read("css/styles.css");
  const data = await read("js/data.js");
  const context = {};
  vm.runInNewContext(data + ";globalThis.assets = ASSETS;", context);
  const assets = {};
  for (const [key, filename] of Object.entries(context.assets)) {
    const bytes = await fs.readFile(path.join(root, filename));
    assets[key] = "data:image/png;base64," + bytes.toString("base64");
  }

  // Inline only the explicitly declared local stylesheet and scripts.
  const stylesheet = '<link rel="stylesheet" href="css/styles.css"';
  if (!html.includes(stylesheet)) throw new Error("Missing main stylesheet");
  html = html.replace(
    /<link rel="stylesheet" href="css\/styles.css"\s*\/?\s*>/,
    () => "<style>\n" + styles + "\n</style>",
  );

  for (const match of [
    ...html.matchAll(/<script src="(js\/[^"<>]+\.js)"><\/script>/g),
  ]) {
    let script = await read(match[1]);
    if (match[1] === "js/data.js") {
      // Assign after declarations so data.js remains the sole data source.
      script += "\nObject.assign(ASSETS, " + JSON.stringify(assets) + ");\n";
    }
    // A literal closing tag in a JS string must not terminate the HTML script.
    html = html.replace(
      match[0],
      () =>
        "<script>\n" +
        script.replace(/<\/script/gi, "<\\/script") +
        "\n</script>",
    );
  }
  html = html.replace('href="dist/训练肌肉图谱.zip"', 'href="#"');
  html = html.replace(
    "图片、文字和代码均保存在本地，无需联网。",
    "所有图片、文字和代码均内嵌，无需联网。",
  );
  if (/<script[^>]+src=|<link[^>]+rel="stylesheet"/.test(html)) {
    throw new Error("Portable edition still references source files");
  }
  const directory = path.join(root, "dist");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "训练肌肉图谱.html"), html);
  const archive = zip([
    { name: "训练肌肉图谱.html", data: html },
    {
      name: "办公室碎片化运动方案.png",
      data: await fs.readFile(path.join(root, context.assets.office)),
    },
  ]);
  await fs.writeFile(
    path.join(directory, "训练肌肉图谱.zip"),
    Buffer.from(await archive.arrayBuffer()),
  );
  console.log("Built dist/训练肌肉图谱.html and dist/训练肌肉图谱.zip");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
