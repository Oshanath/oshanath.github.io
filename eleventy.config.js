export default function (config) {
  config.addPassthroughCopy({ "assets": "assets" });
  config.addWatchTarget("content/");
  config.addWatchTarget("site.json");
  config.addWatchTarget("lib/");
  config.addWatchTarget("previews.json");
  return { dir: { input: "src", output: "_site" } };
}
