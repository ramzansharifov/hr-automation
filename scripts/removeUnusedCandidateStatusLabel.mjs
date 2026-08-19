import fs from "node:fs";

const path = "src/pages/recruitment/VacancyDetailsPage.tsx";
let source = fs.readFileSync(path, "utf8");
const block = `function candidateStatusLabel(value: string): string {\n  return candidateStatusOptions.find((item) => item.value === value)?.label ?? value;\n}\n`;
if (!source.includes(block)) throw new Error("Unused candidateStatusLabel block not found");
source = source.replace(block, "");
fs.writeFileSync(path, source);
for (const file of ["scripts/removeUnusedCandidateStatusLabel.mjs", ".github/workflows/candidate-card-cleanup.yml"]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
