import { describe, expect, it } from "vitest"

import { extractSettingsRowsFromHtml } from "@/lib/utilities/windows-settings-json-engine"

describe("extractSettingsRowsFromHtml", () => {
  it("extracts settings page and single URI from table rows", () => {
    const html = `
      <table class="table table-sm margin-top-none">
        <thead>
          <tr><th>Settings page</th><th>URI</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Access work or school</td>
            <td>ms-settings:workplace</td>
          </tr>
        </tbody>
      </table>
    `

    const result = extractSettingsRowsFromHtml(html)

    expect(result).toEqual([
      {
        settingsPage: "Access work or school",
        uri: "ms-settings:workplace",
      },
    ])
  })

  it("extracts multiple URI tokens from one cell preserving order", () => {
    const html = `
      <table>
        <thead>
          <tr><th>Settings page</th><th>URI</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Offline Maps</td>
            <td>
              ms-settings:maps<br>
              ms-settings:maps-downloadmaps (Download maps)
            </td>
          </tr>
        </tbody>
      </table>
    `

    const result = extractSettingsRowsFromHtml(html)

    expect(result).toEqual([
      {
        settingsPage: "Offline Maps",
        uri: ["ms-settings:maps", "ms-settings:maps-downloadmaps"],
      },
    ])
  })

  it("deduplicates repeated URI tokens in the same row", () => {
    const html = `
      <table>
        <thead>
          <tr><th>Settings page</th><th>URI</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>General</td>
            <td>ms-settings:privacy or ms-settings:privacy</td>
          </tr>
        </tbody>
      </table>
    `

    const result = extractSettingsRowsFromHtml(html)

    expect(result).toEqual([
      {
        settingsPage: "General",
        uri: "ms-settings:privacy",
      },
    ])
  })

  it("ignores rows without URI tokens", () => {
    const html = `
      <table>
        <thead>
          <tr><th>Settings page</th><th>URI</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Not valid</td>
            <td>No settings URI available</td>
          </tr>
        </tbody>
      </table>
    `

    const result = extractSettingsRowsFromHtml(html)

    expect(result).toEqual([])
  })
})
