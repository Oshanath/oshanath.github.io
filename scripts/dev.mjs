import { spawn } from "node:child_process";

// Accept common preview-runner flags, forwarding Eleventy's supported port flag.
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : args.find(a => a.startsWith("--port="))?.split("=")[1];
if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) throw new Error("Invalid port");
const child = spawn(process.execPath, ["node_modules/@11ty/eleventy/cmd.cjs", "--serve", ...(port ? [`--port=${port}`] : [])], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));
