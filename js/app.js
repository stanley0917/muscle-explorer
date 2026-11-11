const $ = (s) => document.querySelector(s);
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const model = AtlasModel.createModel(EXERCISES, MUSCLES);
const purpose = (e) =>
  e.name === "站姿提踵"
    ? { kind: "shared", short: "共用", label: "主训练 / 办公室运动" }
    : e.tag === "办公室"
      ? { kind: "office", short: "办公", label: "办公室运动" }
      : { kind: "strength", short: "主训", label: "主训练" };
const purposeBadge = (e) =>
  `<span class="purpose-badge ${purpose(e).kind}">${purpose(e).short}</span>`;
const names = (ids) => ids.map((id) => MUSCLES[id].name).join("、");
const selectionKey = (s) => (s ? `${s.kind}:${s.id}` : "neutral");
const pathMarkup = (r) =>
  `<path class="overlay" d="${r.d}"${r.transform ? ` transform="${r.transform}"` : ""}/>`;
const labels = LABELS.map(([id, x, y, ax, ay]) => {
  const right = x > 1000,
    name = MUSCLES[id].name,
    w = name.length * 28 + 18;
  const rx = right ? x - w : x,
    edge = right ? rx - 4 : rx + w + 4,
    lane = right
      ? Math.min(edge - 30, Math.max(ax + 45, 1225))
      : Math.max(edge + 30, Math.min(ax - 45, 35));
  return `<g class="muscle-connector" data-muscle="${id}" aria-hidden="true"><path class="leader" d="M${edge} ${y}H${lane}L${ax} ${ay}"/><circle class="anchor" cx="${ax}" cy="${ay}" r="4"/></g><g class="muscle-label" data-kind="muscle" data-id="${id}" data-muscle="${id}" role="button" tabindex="0" aria-label="${name}，查看可选动作" aria-pressed="false"><rect x="${rx}" y="${y - 20}" width="${w}" height="40"/><text x="${right ? x - 9 : x + 9}" y="${y}" text-anchor="${right ? "end" : "start"}">${name}</text></g>`;
}).join("");
$("#anatomy").innerHTML =
  `<svg viewBox="-170 0 1594 1285" aria-label="人体正面与背面肌肉图谱"><defs><image id="deep-source" href="${ASSETS.deep}" width="1536" height="1024"/></defs><image href="${ASSETS.body}" x="0" y="0" width="1254" height="1254" pointer-events="none"/>${Object.entries(
    REGIONS,
  )
    .map(
      ([id, rs]) =>
        `<g class="muscle-zone" data-kind="muscle" data-id="${id}" data-muscle="${id}" role="button" tabindex="0" aria-label="${MUSCLES[id].name}肌肉区域，查看可选动作" aria-pressed="false">${rs.map(pathMarkup).join("")}</g>`,
    )
    .join(
      "",
    )}${labels}<text class="view-name" x="334" y="1270" text-anchor="middle">正面</text><text class="view-name" x="914" y="1270" text-anchor="middle">背面</text></svg>`;
const deepSubs = {
  brachialis: "肱二头肌深层",
  rhomboids: "斜方肌深层",
  cuff: "冈下肌 · 小圆肌",
  transverse: "腹壁深层",
  soleus: "腓肠肌深层",
  erectors: "腰背筋膜深层",
};
const cutaway = (d, suffix) =>
  `<svg viewBox="${d.box.join(" ")}" aria-hidden="true"><defs><clipPath id="clip-${d.id}-${suffix}"><rect x="${d.box[0]}" y="${d.box[1]}" width="${d.box[2]}" height="${d.box[3]}"/></clipPath></defs><g clip-path="url(#clip-${d.id}-${suffix})"><use href="#deep-source"/><path class="overlay" d="${d.d}"/></g></svg>`;
$("#deep-diagrams").innerHTML = DEEP.map(
  (d) =>
    `<button class="deep-card muscle-zone" data-kind="muscle" data-id="${d.id}" data-muscle="${d.id}" aria-label="${MUSCLES[d.id].name}局部剖示，查看可选动作" aria-pressed="false">${cutaway(d, "small")}<span class="deep-name">${MUSCLES[d.id].name}</span><span class="deep-sub">${deepSubs[d.id]}</span></button>`,
).join("");

let pinned = null,
  preview = null,
  leaveTimer = null,
  lastDetails = "";
const current = () => preview || pinned;
const showSecondary = () => $("#secondary-toggle").checked;
const query = () => $("#search").value;
function renderList() {
  const visible = EXERCISES.filter((e) => model.exerciseMatches(e, query()));
  $("#count").textContent = visible.length + " / 35 个动作";
  $("#clear-search").hidden = !query();
  $("#exercise-list").innerHTML = ["躯干", "四肢"]
    .map((group) => {
      const subset = visible.filter((e) => e.group === group);
      return `<section class="action-group" aria-label="${group}训练"><h2>${group}训练<small>${subset.length} 项</small></h2>${subset.length ? `<div class="action-grid">${subset.map((e) => `<button class="exercise-btn purpose-${purpose(e).kind}" data-purpose="${purpose(e).kind}" data-kind="exercise" data-id="${e.id}" aria-pressed="false"><span class="action-name">${e.name}</span>${purposeBadge(e)}</button>`).join("")}</div>` : '<p class="empty">没有匹配的动作</p>'}</section>`;
    })
    .join("");
}
function renderDetails(active) {
  const key = selectionKey(active) + "/" + showSecondary() + "/" + query();
  if (key === lastDetails) return;
  lastDetails = key;
  let html = "";
  if (!active) {
    html = `<div class="welcome-icon" aria-hidden="true">↔</div><h2 id="detail-title">从你想练的地方开始</h2><p class="intro">这张图谱把动作、肌肉位置和训练要领放在一起。</p><div class="welcome-guide"><p><strong>找肌肉</strong><br>悬停左侧动作，查看它主要练习哪些肌肉。</p><p><strong>找动作</strong><br>悬停图中的肌肉或名称，查看可以选用的动作。</p><p><strong>留住结果</strong><br>点击肌肉或动作可固定；临时预览后，移开鼠标即可恢复。按 Esc 回到这里。</p></div><p class="minor">上方正背面图显示表层位置，下方局部剖示补充深层肌群。</p>`;
  } else if (active.kind === "exercise") {
    const e = model.byId.get(active.id);
    html = `<div class="detail-meta"><span class="type">${e.group}训练</span><span class="purpose-detail ${purpose(e).kind}">${purpose(e).label}</span></div><h2 id="detail-title">${e.name}</h2><p class="intro">${e.focus || "用可控制的动作，找到主要发力部位。"}</p>${purpose(e).kind !== "strength" ? `<p class="purpose-note">${purpose(e).kind === "shared" ? "同一动作同时用于主训练与办公室活动；办公时以轻松、可控制的练习为主。" : "用于久坐间隙的轻量活动；保持轻松，不追求力竭。"}</p>` : ""}<div class="section-title">主要训练</div><div class="tags">${e.primary.map((id) => `<span>${MUSCLES[id].name}</span>`).join("")}</div><div class="section-title">怎么做</div><ol class="steps">${e.steps.map((s) => `<li>${s}</li>`).join("")}</ol><div class="note-box"><span>要点说明</span><p>${e.note}</p></div>${e.secondary.length ? `<div class="section-title">辅助与稳定</div><p class="minor">${names(e.secondary)}。仅列重点参与肌群。</p>` : ""}`;
  } else {
    const m = MUSCLES[active.id],
      r = model.reverse[active.id];
    const candidateList = (items, secondary = false) =>
      `<div class="candidate-list">${items.map((e) => `<button class="candidate ${secondary ? "secondary" : ""}" data-pick="${e.id}"><span>${e.name}</span>${purposeBadge(e)}${active.id === "pecUpper" ? `<small>${e.primary.includes("pecUpper") ? "偏上部纤维" : "整体胸大肌训练，上部也参与"}</small>` : ""}</button>`).join("")}</div>`;
    html = `<div class="detail-meta"><span class="type">肌肉 → 动作</span><span>${m.deep ? "局部剖示" : "体表定位"}</span></div><h2 id="detail-title">${m.name}</h2><div class="section-title">在哪里</div><p class="muscle-fact">${m.location}</p><div class="section-title">主要作用</div><p class="muscle-fact">${m.function}</p>${m.note ? `<div class="note-box"><p>${m.note}</p></div>` : ""}<div class="section-title">主要训练动作 · ${r.primary.length}</div>${r.primary.length ? candidateList(r.primary) : '<p class="minor">当前计划没有以此为主要目标的动作。</p>'}${showSecondary() ? `<div class="section-title">辅助参与动作 · ${r.secondary.length}</div>${r.secondary.length ? candidateList(r.secondary, true) : '<p class="minor">当前计划未列出辅助参与动作。</p>'}` : r.secondary.length ? `<p class="minor">另有 ${r.secondary.length} 个动作以它辅助发力或稳定。<button data-enable-secondary>显示辅助参与</button></p>` : ""}<p class="minor">点击肌肉可固定此列表；点击动作查看要领。</p>`;
  }
  $("#detail-content").innerHTML = html;
  if (active?.kind === "muscle" && MUSCLES[active.id].cutaway) {
    const d = MUSCLES[active.id].cutaway;
    $("#detail-title").insertAdjacentHTML(
      "afterend",
      `<div class="detail-cutaway muscle-zone is-inspected">${cutaway(d, "detail")}</div>`,
    );
  }
  $("#detail-content").scrollTop = 0;
  $("#live").textContent = active
    ? active.kind === "exercise"
      ? model.byId.get(active.id).name +
        "，主要训练" +
        names(model.byId.get(active.id).primary)
      : MUSCLES[active.id].name +
        "，" +
        model.reverse[active.id].primary.length +
        "个主要训练动作"
    : "自由探索";
}
function render() {
  const active = current();
  let roles = {},
    primaryIds = new Set(),
    secondaryIds = new Set();
  if (active?.kind === "exercise")
    roles = model.exerciseRoles(model.byId.get(active.id), showSecondary());
  if (active?.kind === "muscle") {
    roles[active.id] = "inspected";
    if (active.id === "pec") roles.pecUpper = "inspected";
    const r = model.reverse[active.id];
    primaryIds = new Set(r.primary.map((e) => e.id));
    if (showSecondary()) secondaryIds = new Set(r.secondary.map((e) => e.id));
  }
  document.querySelectorAll("[data-muscle]").forEach((el) => {
    const role = roles[el.dataset.muscle];
    ["primary", "secondary", "inspected"].forEach((r) =>
      el.classList.toggle("is-" + r, role === r),
    );
    el.setAttribute(
      "aria-pressed",
      String(pinned?.kind === "muscle" && pinned.id === el.dataset.muscle),
    );
  });
  document.querySelectorAll(".exercise-btn").forEach((el) => {
    const id = el.dataset.id;
    el.classList.toggle(
      "is-active",
      active?.kind === "exercise" && active.id === id,
    );
    el.classList.toggle("is-related-primary", primaryIds.has(id));
    el.classList.toggle("is-related-secondary", secondaryIds.has(id));
    const isPinned = pinned?.kind === "exercise" && pinned.id === id;
    el.classList.toggle("is-pinned", isPinned);
    el.setAttribute("aria-pressed", String(isPinned));
  });
  $("#state").textContent = preview
    ? "悬停预览"
    : pinned
      ? "已固定"
      : "自由探索";
  $("#unpin").hidden = !pinned;
  const related = [...primaryIds, ...secondaryIds],
    hidden = related.filter(
      (id) => !model.exerciseMatches(model.byId.get(id), query()),
    ).length;
  $("#hidden-matches").hidden = !hidden;
  $("#hidden-matches").innerHTML = hidden
    ? `当前肌肉有 ${hidden} 个关联动作被搜索隐藏。<button data-clear-search>清空搜索</button>`
    : "";
  renderDetails(active);
}
function cancelLeave() {
  clearTimeout(leaveTimer);
  leaveTimer = null;
}
function setPreview(selection) {
  cancelLeave();
  if (selectionKey(preview) === selectionKey(selection)) return;
  preview = selection;
  render();
}
function clearPreviewSoon() {
  cancelLeave();
  leaveTimer = setTimeout(() => {
    preview = null;
    render();
  }, 100);
}
function setPinned(selection) {
  cancelLeave();
  pinned = selection;
  preview = null;
  render();
}
function reset() {
  cancelLeave();
  pinned = null;
  preview = null;
  render();
}
function fromTarget(target) {
  const el = target instanceof Element ? target.closest("[data-kind]") : null;
  return el ? { kind: el.dataset.kind, id: el.dataset.id } : null;
}
document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const s = fromTarget(event.target);
  if (s) setPreview(s);
});
document.addEventListener("pointerout", (event) => {
  if (event.pointerType === "touch") return;
  const from = fromTarget(event.target),
    to = fromTarget(event.relatedTarget);
  if (from && selectionKey(from) !== selectionKey(to)) clearPreviewSoon();
});
document.addEventListener("focusin", (event) => {
  const s = fromTarget(event.target);
  if (s) setPreview(s);
});
document.addEventListener("focusout", (event) => {
  const from = fromTarget(event.target),
    to = fromTarget(event.relatedTarget);
  if (from && selectionKey(from) !== selectionKey(to)) clearPreviewSoon();
});
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const candidate = target.closest("[data-pick]");
  if (candidate) {
    setPinned({ kind: "exercise", id: candidate.dataset.pick });
    return;
  }
  if (target.closest("[data-enable-secondary]")) {
    $("#secondary-toggle").checked = true;
    preview = null;
    render();
    return;
  }
  if (target.closest("[data-clear-search]")) {
    clearSearch();
    return;
  }
  const s = fromTarget(target);
  if (s) setPinned(s);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    reset();
    return;
  }
  const t = event.target;
  if (!(t instanceof Element)) return;
  if (t.matches("g[data-kind]") && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    setPinned(fromTarget(t));
  }
  if (
    t.matches(".exercise-btn") &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
      event.key,
    )
  ) {
    const bs = [...document.querySelectorAll(".exercise-btn")],
      i = bs.indexOf(t);
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? bs.length - 1
          : i +
            { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[
              event.key
            ];
    bs[Math.max(0, Math.min(bs.length - 1, next))].focus();
  }
});
function clearSearch() {
  $("#search").value = "";
  preview = null;
  cancelLeave();
  renderList();
  render();
}
$("#search").addEventListener("input", () => {
  cancelLeave();
  preview = null;
  renderList();
  render();
});
$("#clear-search").addEventListener("click", clearSearch);
$("#secondary-toggle").addEventListener("change", render);
$("#unpin").addEventListener("click", reset);
renderList();
render();

// Serialize a clean, reusable copy; rendered artwork is rebuilt from the embedded assets.
function shareableSource() {
  const copy = document.documentElement.cloneNode(true);
  for (const id of [
    "anatomy",
    "deep-diagrams",
    "exercise-list",
    "detail-content",
    "live",
  ])
    copy.querySelector("#" + id).replaceChildren();
  copy.querySelectorAll(".archive-trigger").forEach((el) => el.remove());
  copy.querySelector("#search").removeAttribute("value");
  copy.querySelector("#secondary-toggle").removeAttribute("checked");
  for (const id of ["clear-search", "unpin", "hidden-matches"])
    copy.querySelector("#" + id).setAttribute("hidden", "");
  copy.querySelector("#hidden-matches").textContent = "";
  copy.querySelector("#state").textContent = "自由探索";
  copy.querySelector("#count").textContent = "35 个动作";
  copy.querySelector("#download-status").textContent = "";
  copy.querySelector("#download-source").removeAttribute("aria-busy");
  return "<!DOCTYPE html>\n" + copy.outerHTML;
}
$("#download-source").addEventListener("click", (event) => {
  // The source edition downloads the archive generated by scripts/build-share.cjs.
  if (!ASSETS.office.startsWith("data:")) return;
  event.preventDefault();
  const link = event.currentTarget;
  if (link.getAttribute("aria-busy") === "true") return;
  link.setAttribute("aria-busy", "true");
  $("#download-status").textContent = "正在打包…";
  try {
    const png = Uint8Array.from(atob(ASSETS.office.split(",")[1]), (ch) =>
      ch.charCodeAt(0),
    );
    const archive = AtlasDownload.zip([
      { name: "训练肌肉图谱.html", data: shareableSource() },
      { name: "办公室碎片化运动方案.png", data: png },
    ]);
    const url = URL.createObjectURL(archive),
      a = document.createElement("a");
    a.className = "archive-trigger";
    a.hidden = true;
    a.href = url;
    a.download = "训练肌肉图谱.zip";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $("#download-status").textContent = "";
  } catch (error) {
    $("#download-status").textContent = "打包失败，请重试。";
    console.error("Archive creation failed", error);
  } finally {
    link.removeAttribute("aria-busy");
  }
});
