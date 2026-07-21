import { CompanyPersona } from "@/server/data/types";
import { readData } from "@/server/data/store";

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s()（）【】\[\]·,，.。-]/g, "").trim();
}

function candidates(persona: CompanyPersona) {
  return [persona.companyName, ...persona.aliases].map(normalize).filter(Boolean);
}

export async function listCompanyPersonas() {
  const data = await readData();
  return data.companyPersonas || [];
}

export async function findCompanyPersonaById(id: string) {
  const personas = await listCompanyPersonas();
  return personas.find((persona) => persona.id === id) || null;
}

export async function findCompanyPersonaByName(name: string) {
  const query = normalize(name);
  if (!query) return null;

  const personas = await listCompanyPersonas();
  return personas.find((persona) => {
    return candidates(persona).some((candidate) => query.includes(candidate) || candidate.includes(query));
  }) || null;
}
