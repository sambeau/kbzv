// src/lib/constants/type-colours.ts

export interface TypeColour {
  bg: string;   // Tailwind bg class
  text: string; // Tailwind text class
}

export const DOC_TYPE_COLOURS: Record<string, TypeColour> = {
  "design":        { bg: "bg-blue-100",   text: "text-blue-800" },
  "specification": { bg: "bg-teal-100",   text: "text-teal-800" },
  "dev-plan":      { bg: "bg-indigo-100", text: "text-indigo-800" },
  "research":      { bg: "bg-amber-100",  text: "text-amber-800" },
  "report":        { bg: "bg-slate-100",  text: "text-slate-700" },
  "policy":        { bg: "bg-rose-100",   text: "text-rose-800" },
  "rca":           { bg: "bg-orange-100", text: "text-orange-800" },
};

const UNKNOWN_TYPE_COLOUR: TypeColour = {
  bg: "bg-gray-100",
  text: "text-gray-600",
};

export function getTypeColour(type: string): TypeColour {
  return DOC_TYPE_COLOURS[type] ?? UNKNOWN_TYPE_COLOUR;
}
