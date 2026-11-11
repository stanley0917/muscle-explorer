(function (root) {
  function createModel(exercises, muscles) {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const keys = Object.keys(muscles);
    const family = (a, b) =>
      a === b || muscles[a]?.parent === b || muscles[b]?.parent === a;
    const matches = (ids, m) => ids.some((id) => family(id, m));
    const reverse = Object.fromEntries(
      keys.map((id) => [
        id,
        {
          primary: exercises.filter((e) => matches(e.primary, id)),
          secondary: exercises.filter(
            (e) => !matches(e.primary, id) && matches(e.secondary, id),
          ),
        },
      ]),
    );
    function exerciseRoles(e, showSecondary) {
      const roles = {};
      keys.forEach((id) => {
        // Whole chest illuminates clavicular fibers; upper-chest focus does not paint the entire chest.
        const belongs = (ids) =>
          ids.includes(id) ||
          (muscles[id]?.parent && ids.includes(muscles[id].parent));
        if (belongs(e.primary)) roles[id] = "primary";
        else if (showSecondary && belongs(e.secondary)) roles[id] = "secondary";
      });
      return roles;
    }
    function exerciseMatches(e, query) {
      const q = query.trim().toLowerCase();
      const usage =
        e.name === "站姿提踵"
          ? "共用 主训练 办公室运动"
          : e.tag === "办公室"
            ? "办公室运动"
            : "主训练";
      return (
        !q ||
        (
          e.name +
          " " +
          usage +
          " " +
          [...e.primary, ...e.secondary].map((id) => muscles[id].name).join(" ")
        )
          .toLowerCase()
          .includes(q)
      );
    }
    return { byId, reverse, exerciseRoles, exerciseMatches, family };
  }
  root.AtlasModel = { createModel };
  if (typeof module !== "undefined") module.exports = root.AtlasModel;
})(typeof globalThis !== "undefined" ? globalThis : this);
