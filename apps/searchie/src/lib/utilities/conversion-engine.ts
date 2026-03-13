export type ConversionRequest = {
  value: number;
  fromUnit: string;
  toUnit: string;
};

const CONNECTORS = ["to", "a", "para", "en"];

const LENGTH_FACTORS: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const WEIGHT_FACTORS: Record<string, number> = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  lb: 0.45359237,
  oz: 0.028349523125,
};

const TEMPERATURE_UNITS = new Set(["c", "f", "k"]);

const UNIT_ALIASES: Record<string, string> = {
  // Length
  millimeter: "mm",
  millimeters: "mm",
  millimetre: "mm",
  millimetres: "mm",
  centimeter: "cm",
  centimeters: "cm",
  centimetre: "cm",
  centimetres: "cm",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  kilometres: "km",
  mile: "mi",
  miles: "mi",
  inch: "in",
  inches: "in",
  foot: "ft",
  feet: "ft",
  yard: "yd",
  yards: "yd",

  // Weight
  milligram: "mg",
  milligrams: "mg",
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",

  // Temperature
  celsius: "c",
  centigrade: "c",
  fahrenheit: "f",
  kelvin: "k",
};

function normalizeUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  return UNIT_ALIASES[normalized] ?? normalized;
}

export function parseConversionQuery(query: string): ConversionRequest | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const regex = /^(-?\d+(?:\.\d+)?)\s*([a-z]+)\s+(to|a|para|en)\s+([a-z]+)$/i;
  const match = trimmed.match(regex);
  if (!match) {
    return null;
  }

  const [, rawValue, fromRaw, connector, toRaw] = match;
  if (!CONNECTORS.includes(connector.toLowerCase())) {
    return null;
  }

  const value = Number.parseFloat(rawValue);
  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    value,
    fromUnit: normalizeUnit(fromRaw),
    toUnit: normalizeUnit(toRaw),
  };
}

function convertTemperature(value: number, fromUnit: string, toUnit: string): number {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  let celsius: number;
  if (from === "c") {
    celsius = value;
  } else if (from === "f") {
    celsius = ((value - 32) * 5) / 9;
  } else if (from === "k") {
    celsius = value - 273.15;
  } else {
    throw new Error(`Unsupported conversion unit: ${fromUnit}`);
  }

  if (to === "c") {
    return celsius;
  }
  if (to === "f") {
    return (celsius * 9) / 5 + 32;
  }
  if (to === "k") {
    return celsius + 273.15;
  }

  throw new Error(`Unsupported conversion unit: ${toUnit}`);
}

export function convertValue(request: ConversionRequest): number {
  const from = normalizeUnit(request.fromUnit);
  const to = normalizeUnit(request.toUnit);

  if (from === to) {
    return request.value;
  }

  if (from in LENGTH_FACTORS && to in LENGTH_FACTORS) {
    const meters = request.value * LENGTH_FACTORS[from];
    return meters / LENGTH_FACTORS[to];
  }

  if (from in WEIGHT_FACTORS && to in WEIGHT_FACTORS) {
    const kilograms = request.value * WEIGHT_FACTORS[from];
    return kilograms / WEIGHT_FACTORS[to];
  }

  if (TEMPERATURE_UNITS.has(from) && TEMPERATURE_UNITS.has(to)) {
    return convertTemperature(request.value, from, to);
  }

  throw new Error(`Unsupported conversion: ${from} -> ${to}`);
}
