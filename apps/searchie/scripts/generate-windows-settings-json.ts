import { writeFile } from "node:fs/promises"
import { extractSettingsRowsFromHtml } from "../src/lib/utilities/windows-settings-json-engine"

const SOURCE_URL =
  "https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings"

const OUTPUT_PATH = new URL("../public/settings.json", import.meta.url)

const main = async (): Promise<void> => {
  const response = await fetch(SOURCE_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const settings = extractSettingsRowsFromHtml(html)

  await writeFile(OUTPUT_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8")

  console.log(`Wrote ${settings.length} rows to public/settings.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
