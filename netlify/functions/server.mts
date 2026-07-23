import serverEntrypoint from "../../dist/server/server.js";

if (typeof serverEntrypoint?.fetch !== "function") {
  throw new Error("The production server entry point does not expose a fetch handler.");
}

export default serverEntrypoint.fetch;

export const config = {
  name: "CollabManga server",
  path: "/*",
  preferStatic: true,
};
