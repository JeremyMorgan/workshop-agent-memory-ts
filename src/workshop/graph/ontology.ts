// Turns the participant's ontology.ts into the three things the harness needs: a validated structure, an extraction
// schema for the model, and the prompt text that describes it. Labels and relationship types are interpolated into
// Cypher elsewhere, so validation here is what keeps that safe.
import { z } from "zod";
import { ontology as userOntology, type Ontology } from "../../../ontology.js";

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;
/** The reserved names the harness itself uses. An ontology may not redefine them. */
const RESERVED = ["User", "Fact", "Rule", "Message", "SystemMessage", "Step", "ToolCall", "Session", "Tool"];

/** Throws a readable error when the ontology could not be used safely. Returns the ontology. */
export function validateOntology(o: Ontology): Ontology {
  const bad = (what: string, name: string) => { throw new Error(`ontology.ts: ${what} "${name}" must be letters, numbers and underscores, starting with a letter`); };
  const types = Object.keys(o.entities);
  if (!types.length) throw new Error("ontology.ts: define at least one entity type");
  const seen = new Set<string>();
  for (const [type, def] of Object.entries(o.entities)) {
    if (!IDENT.test(type)) bad("entity type", type);
    for (const label of [type, ...Object.keys(def.subtypes)]) {
      if (!IDENT.test(label)) bad("label", label);
      if (RESERVED.includes(label)) throw new Error(`ontology.ts: "${label}" is used by the workshop itself, pick another name`);
      if (seen.has(label)) throw new Error(`ontology.ts: "${label}" is defined twice`);
      seen.add(label);
    }
  }
  for (const [rel, def] of Object.entries(o.relations)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(rel)) throw new Error(`ontology.ts: relationship "${rel}" must be UPPER_SNAKE_CASE`);
    for (const t of [...def.from, ...def.to]) if (!types.includes(t)) throw new Error(`ontology.ts: relationship ${rel} mentions "${t}", which is not an entity type`);
  }
  return o;
}

export const ontology = validateOntology(userOntology);

export const entityTypes = (o: Ontology = ontology) => Object.keys(o.entities);
export const relationTypes = (o: Ontology = ontology) => Object.keys(o.relations);
export const allSubtypes = (o: Ontology = ontology) => Object.values(o.entities).flatMap((e) => Object.keys(e.subtypes));
/** The type a subtype belongs to, or undefined when it is not a subtype of anything. */
export const parentOf = (subtype: string, o: Ontology = ontology) => entityTypes(o).find((t) => subtype in o.entities[t].subtypes);

const oneOf = (values: string[]) => z.enum(values as [string, ...string[]]);

/** The Zod schema the extraction model fills in. Types, subtypes and relationship names are limited to the ontology. */
export function buildExtractionSchema(o: Ontology = ontology) {
  const subtypes = allSubtypes(o);
  return z.object({
    user: z.object({
      name: z.string().nullish().describe("The user's own name, if they gave it"),
      funFact: z.string().nullish().describe("A fun fact the user shared about themselves"),
      preferences: z.array(z.string()).describe("Preferences the user stated about how they like things done, including the language they want replies in (e.g. \"replies in Spanish\")"),
    }),
    entities: z.array(z.object({
      type: oneOf(entityTypes(o)),
      subtype: (subtypes.length ? oneOf(subtypes) : z.string()).nullish().describe("What kind of that type it is. Must belong to the type. Leave empty when none fits."),
      name: z.string(),
      description: z.string().nullish(),
    }).refine((e) => !e.subtype || parentOf(e.subtype, o) === e.type, { message: "subtype does not belong to type" }))
      .describe("Other things the user mentioned, typed by the ontology. Not the user themself."),
    relations: z.array(z.object({
      from: z.string().describe("An entity name, or 'user' for the user"),
      type: oneOf(relationTypes(o)),
      to: z.string().describe("An entity name"),
    })),
  });
}

/** The extractor's instructions for entities and relations, written from the ontology. */
export function renderOntologyForPrompt(o: Ontology = ontology): string {
  const entities = Object.entries(o.entities).map(([type, d]) => {
    const subs = Object.entries(d.subtypes).map(([s, desc]) => `    - ${s}: ${desc}`).join("\n");
    return `  ${type}: ${d.description}${subs ? `\n${subs}` : ""}`;
  }).join("\n");
  const relations = Object.entries(o.relations).map(([r, d]) => {
    const ends = d.from.length || d.to.length ? ` (${d.from.join("/") || "any"} -> ${d.to.join("/") || "any"})` : "";
    return `  ${r}${ends}: ${d.description}`;
  }).join("\n");
  const examples = o.examples.map((ex) => `  "${ex.text}" gives entities ${ex.entities.map((e) => `${e.type}${e.subtype ? `:${e.subtype}` : ""} "${e.name}"`).join(", ")} and relations ${ex.relations.map((r) => `${r.from} ${r.type} ${r.to}`).join(", ")}`).join("\n");
  return `Return entities and relations using this ontology. Entities are things the user mentions other than themself. Give each entity its type and, when one fits, its subtype.
Entity types and subtypes:
${entities}
Relationship types (relations connect the user, written "user", or an entity to another entity):
${relations}${examples ? `\nExamples:\n${examples}` : ""}
Every relation endpoint must also appear in entities (except "user"). Only use the types, subtypes and relationship types listed.`;
}
