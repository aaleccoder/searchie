export type SettingsRow = {
  settingsPage: string
  uri: string | string[]
}

const normalizeText = (text: string): string =>
  text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

const stripTags = (html: string): string =>
  decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))

const extractUris = (text: string): string[] => {
  const matches = text.match(/ms-settings:[^\s<)\]",;]+/g)
  if (!matches) {
    return []
  }

  const uniqueUris: string[] = []

  for (const uri of matches.map((value) => value.trim())) {
    if (!uniqueUris.includes(uri)) {
      uniqueUris.push(uri)
    }
  }

  return uniqueUris
}

const extractRowsFromTable = (tableHtml: string): SettingsRow[] => {
  const rowMatches = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (rowMatches.length < 2) {
    return []
  }

  const rows: SettingsRow[] = []

  for (const rowMatch of rowMatches.slice(1)) {
    const cellMatches = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    if (cellMatches.length < 2) {
      continue
    }

    const settingsPage = normalizeText(stripTags(cellMatches[0][1]))
    const uriTokens = extractUris(stripTags(cellMatches[1][1]))

    if (!settingsPage || uriTokens.length === 0) {
      continue
    }

    rows.push({
      settingsPage,
      uri: uriTokens.length === 1 ? uriTokens[0] : uriTokens,
    })
  }

  return rows
}

export const extractSettingsRowsFromHtml = (html: string): SettingsRow[] => {
  const tableMatches = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
  const rows: SettingsRow[] = []

  for (const tableMatch of tableMatches) {
    rows.push(...extractRowsFromTable(tableMatch[0]))
  }

  return rows
}
