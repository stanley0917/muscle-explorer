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
const named = (names) =>
  exercises
    .filter((e) => names.includes(e.name))
    .map((e) => e.id)
    .sort();
test("All 35 original actions retain unique IDs, two groups and complete guidance", () => {
  assert.equal(exercises.length, 35);
  assert.equal(new Set(exercises.map((e) => e.id)).size, 35);
  assert.deepEqual(
    [...new Set(exercises.map((e) => e.group))],
    ["躯干", "四肢"],
  );
  for (const e of exercises) {
    assert.equal(e.steps.length, 3);
    assert.ok(e.note);
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
    model.reverse.lats.primary.map((e) => e.id).sort(),
    named([
      "引体向上",
      "弹力带高位下拉",
      "弹力带坐姿划船",
      "单臂哑铃划船",
      "俯身弹力带划船",
      "弹力带直臂下压",
    ]),
  );
  assert.deepEqual(
    model.reverse.triceps.primary.map((e) => e.id).sort(),
    named(["弹力带三头肌下压", "椅上臂屈伸"]),
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
    35,
  );
  assert.equal(
    exercises.filter((e) => model.exerciseMatches(e, "不存在动作")).length,
    0,
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
