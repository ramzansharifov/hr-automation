import fs from "node:fs";

const path = "src/pages/recruitment/VacancyDetailsPage.tsx";
let source = fs.readFileSync(path, "utf8");
const block = `const candidateStatusOptions = [\n  { value: "new", label: "Новый" },\n  { value: "screening", label: "Первичный отбор" },\n  { value: "interview", label: "Собеседование" },\n  { value: "offer", label: "Оффер" },\n  { value: "hired", label: "Принят" },\n  { value: "rejected", label: "Отклонён" },\n];\n`;
if (!source.includes(block)) throw new Error("Unused candidateStatusOptions block not found");
source = source.replace(block, "");
fs.writeFileSync(path, source);
for (const file of ["scripts/removeUnusedCandidateStatusOptions.mjs", ".github/workflows/candidate-card-final-cleanup.yml"]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
