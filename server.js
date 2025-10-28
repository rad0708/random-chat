const { spawn, execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const PORT = process.env.PORT || 3000

const nextDir = path.join(process.cwd(), ".next")
if (!fs.existsSync(nextDir)) {
  console.log("No production build found. Building the app...")
  try {
    execSync("npm run build", { stdio: "inherit" })
    console.log("Build completed successfully!")
  } catch (error) {
    console.error("Build failed:", error)
    process.exit(1)
  }
}

console.log("Starting Next.js production server...")
console.log(`Port: ${PORT}`)

const nextStart = spawn("node", ["--max-old-space-size=512", "node_modules/next/dist/bin/next", "start"], {
  env: { ...process.env, PORT: PORT.toString() },
  stdio: "inherit",
  shell: true,
})

nextStart.on("error", (error) => {
  console.error("Failed to start Next.js server:", error)
  process.exit(1)
})

nextStart.on("exit", (code) => {
  console.log(`Next.js server exited with code ${code}`)
  process.exit(code || 0)
})

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...")
  nextStart.kill("SIGTERM")
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...")
  nextStart.kill("SIGINT")
})
