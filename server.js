const { spawn } = require("child_process")
const path = require("path")

const PORT = process.env.PORT || 3000

console.log("Starting Next.js production server...")
console.log(`Port: ${PORT}`)

const nextStart = spawn("npm", ["start"], {
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
