/** Editorial project data for Meridian Studio. */

export interface Project {
  slug: string;
  title: string;
  location: string;
  year: string;
  typology: string;
  area: string;
  summary: string;
  description: string[];
  /** Solid panel color used for the typographic project artwork. */
  tone: string;
  toneText: string;
}

export const PROJECTS: readonly Project[] = [
  {
    slug: "courtyard-house",
    title: "Courtyard House",
    location: "Marfa, Texas",
    year: "2025",
    typology: "Residential",
    area: "480 m²",
    summary:
      "A single-storey adobe residence arranged around a shaded internal patio, tuned to desert light.",
    description: [
      "The house is organised as a ring of rooms around an open-air courtyard, so every space borrows light twice — once from the desert, once from the patio. Thick adobe walls keep the interior cool through the day and release warmth after dusk.",
      "Openings are few and precisely placed. A single large aperture in the courtyard frames the western sky, turning sunset into a scheduled event for the family that lives here.",
    ],
    tone: "#b34724",
    toneText: "#f8ede4",
  },
  {
    slug: "atlas-gallery",
    title: "Atlas Gallery",
    location: "Copenhagen, Denmark",
    year: "2024",
    typology: "Cultural",
    area: "1,250 m²",
    summary:
      "A retrofit of a 1920s printing works into a daylit gallery for large-format photography.",
    description: [
      "The existing concrete frame was stripped back to its bones and re-threaded with a series of top-lit rooms. North-facing sawtooth rooflights give the galleries a calm, even wash of light that suits photographic work.",
      "New insertions — stair, lift core, reading room — are kept deliberately quiet in oiled oak and limewash, so the building's industrial memory stays legible.",
    ],
    tone: "#23408e",
    toneText: "#e8edf9",
  },
  {
    slug: "terrace-school",
    title: "Terrace School",
    location: "Porto, Portugal",
    year: "2023",
    typology: "Education",
    area: "3,900 m²",
    summary:
      "A primary school stepped down a hillside in stacked terraces, each classroom with its own outdoor room.",
    description: [
      "Rather than a corridor with classrooms attached, the school is a sequence of terraces. Each pair of classrooms shares a planted outdoor room used for teaching, meals, and unsupervised play.",
      "The section does the climate work: thermal mass, cross ventilation, and deep shade remove the need for mechanical cooling across most of the year.",
    ],
    tone: "#2f5d3f",
    toneText: "#e9f2ea",
  },
  {
    slug: "monolith-spa",
    title: "Monolith Spa",
    location: "Vals, Switzerland",
    year: "2022",
    typology: "Hospitality",
    area: "860 m²",
    summary:
      "A bathhouse carved into a quarry face — water, stone, steam, and almost nothing else.",
    description: [
      "The spa is conceived as a succession of carved chambers rather than built rooms. Light enters through slots worn into the rock, pools are cut directly into the stone floor, and the whole sequence is organised by temperature rather than by programme.",
      "Visitors move from warm to hot to cold along a single gentle loop, surfaced entirely in the quarry's own gneiss.",
    ],
    tone: "#3c3a38",
    toneText: "#efedea",
  },
];

export function findProject(slug: string): Project | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}

export function nextProject(slug: string): Project {
  const index = PROJECTS.findIndex((project) => project.slug === slug);
  return PROJECTS[(index + 1 + PROJECTS.length) % PROJECTS.length];
}
