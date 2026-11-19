const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createModel } = require("../js/model.js");
const path = require("node:path");
const { createHash } = require("node:crypto");
const context = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") +
    ";globalThis.data={MUSCLES,EXERCISES};",
  context,
);
const { MUSCLES: muscles, EXERCISES: exercises } = JSON.parse(
  JSON.stringify(context.data),
);
const approved = require("./fixtures/approved-content.json");
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
assert.equal(digest(muscles), approved.muscles);
assert.equal(digest(exercises), approved.exercises);
const model = createModel(exercises, muscles);
const torso = [
  "平板哑铃卧推",
  "弹力带高位下拉",
  "引体向上",
  "单臂哑铃划船",
  "平板支撑",
  "上斜哑铃卧推",
  "哑铃夹胸",
  "弹力带直臂下压",
  "弹力带坐姿划船",
  "死虫式",
  "墙壁俯卧撑",
];
const limbs = [
  "臀桥",
  "高脚杯深蹲",
  "罗马尼亚硬拉",
  "侧平举",
  "站姿提踵",
  "弹力带腿弯举",
  "杠铃弯举",
  "弹力带三头肌下压",
  "弹力带面拉",
  "箭步蹲",
  "垂直弯举",
  "靠墙天使",
  "椅上臂屈伸",
  "靠墙静蹲",
  "徒手深蹲",
];
test("The catalog contains the requested exercises in order with complete guidance", () => {
  assert.equal(new Set(exercises.map((e) => e.id)).size, 26);
  assert.deepEqual(
    exercises.map((e) => [e.group, e.name]),
    [
      ...torso.map((name) => ["躯干", name]),
      ...limbs.map((name) => ["四肢", name]),
    ],
  );
  const office = [torso.at(-1), ...limbs.slice(-4)];
  for (const e of exercises) {
    assert.equal(e.steps.length, 3);
    assert.ok(e.focus && e.note);
    assert.equal(
      e.tag,
      office.includes(e.name)
        ? "办公室"
        : e.name === "站姿提踵"
          ? "共用"
          : "力量训练",
    );
    for (const id of [...e.primary, ...e.secondary]) assert.ok(muscles[id]);
  }
});
test("Every muscle has real geometry or a cutaway and meaningful metadata", () => {
  vm.runInNewContext(fs.readFileSync(__dirname + "/../js/anatomy.js", "utf8"), {
    MUSCLES: muscles,
  });
  for (const [id, m] of Object.entries(muscles)) {
    assert.ok(m.location && m.function, id);
    assert.ok(m.regions.length || m.cutaway, id);
    assert.ok(m.labels.length || m.cutaway, id);
  }
});
test("Reverse mappings distinguish prime targets from assisting participation", () => {
  assert.deepEqual(
    model.reverse.lats.primary.map((e) => e.name),
    [
      "弹力带高位下拉",
      "引体向上",
      "单臂哑铃划船",
      "弹力带直臂下压",
      "弹力带坐姿划船",
    ],
  );
  assert.deepEqual(
    model.reverse.triceps.primary.map((e) => e.name),
    ["弹力带三头肌下压", "椅上臂屈伸"],
  );
  assert.equal(model.reverse.gluteMed.primary.length, 0);
  assert.equal(model.reverse.gluteMed.secondary.length, 1);
  assert.equal(model.reverse.erectors.primary.length, 0);
  assert.ok(model.reverse.erectors.secondary.length > 0);
  for (const [id, r] of Object.entries(model.reverse)) {
    assert.equal(
      r.primary.filter((e) => r.secondary.includes(e)).length,
      0,
      id,
    );
  }
});
test("Chest hierarchy is reciprocal for discovery but upper-chest overlay stays specific", () => {
  assert.deepEqual(
    model.reverse.pec.primary.map((e) => e.id),
    model.reverse.pecUpper.primary.map((e) => e.id),
  );
  const flat = exercises.find((e) => e.name === "平板哑铃卧推"),
    incline = exercises.find((e) => e.name === "上斜哑铃卧推");
  assert.equal(model.exerciseRoles(flat, false).pecUpper, "primary");
  assert.equal(model.exerciseRoles(incline, false).pecUpper, "primary");
  assert.equal(model.exerciseRoles(incline, false).pec, undefined);
});
test("All action roles and reverse indexes agree, secondary switch does not promote helpers", () => {
  for (const e of exercises) {
    const base = model.exerciseRoles(e, false),
      full = model.exerciseRoles(e, true);
    for (const m of e.primary) {
      assert.equal(base[m], "primary");
      assert.ok(model.reverse[m].primary.includes(e));
    }
    for (const m of e.secondary) {
      if (!e.primary.includes(m)) {
        assert.equal(base[m], undefined);
        assert.equal(full[m], "secondary");
        assert.ok(model.reverse[m].secondary.includes(e));
      }
    }
  }
});
test("Search works across categories; no-result and empty query are deterministic", () => {
  assert.equal(
    exercises.filter((e) => model.exerciseMatches(e, "")).length,
    26,
  );
  assert.equal(
    exercises.filter((e) => model.exerciseMatches(e, "不存在动作")).length,
    0,
  );
  assert.equal(
    exercises.filter((e) => model.exerciseMatches(e, "俯身弹力带划船")).length,
    0,
  );
  assert.deepEqual(
    exercises.filter((e) => model.exerciseMatches(e, "共用")).map((e) => e.name),
    ["站姿提踵"],
  );
  assert.ok(
    exercises
      .filter((e) => model.exerciseMatches(e, "肱三头肌"))
      .some((e) => e.group === "躯干"),
  );
  assert.ok(
    exercises
      .filter((e) => model.exerciseMatches(e, "肱三头肌"))
      .some((e) => e.group === "四肢"),
  );
});
