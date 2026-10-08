/** Pages in reading order, with the overview section that describes each. No content import: the shell uses it. */
export const PAGES: { id: string; label: string; section: string }[] = [
  { id: "deployments", label: "Deployments", section: "deployments" },
  { id: "components", label: "Components", section: "inside" },
  { id: "data", label: "Data", section: "data" },
  { id: "journey", label: "Journey", section: "journey" },
  { id: "outcomes", label: "Outcomes", section: "outcomes" },
  { id: "claims", label: "Claims", section: "myths" },
  { id: "economics", label: "Economics", section: "economics" },
  { id: "sources", label: "Sources", section: "sources" },
];
export const pageFor = (section: string): string | undefined => PAGES.find((p) => p.section === section)?.id;
