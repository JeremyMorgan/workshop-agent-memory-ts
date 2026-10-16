// YOUR ONTOLOGY: what the agent extracts from conversations and saves in the graph.
//
// Every entity has a POLE+O type (Person, Object, Location, Event, Organization) and an optional subtype, which becomes a
// second label in Neo4j: a Person who is an Employee is saved as (:Person:Employee). The descriptions are sent to the
// extraction model, so the clearer you are about what each thing is (and is not), the better the results.
//
// Edit this file to extract more things or different things, then chat again. Nothing else needs to change.
//   - Add a subtype:       Person: { subtypes: { Contractor: "Paid by the hour, not on the payroll" } }
//   - Add a relationship:  REPORTS_TO: { description: "...", from: ["Person"], to: ["Person"] }
//   - Teach by example:    add to `examples` below
//
// Names must be plain identifiers (letters, numbers, underscore). They are used as Neo4j labels and relationship types.

export interface Ontology {
  entities: Record<string, { description: string; subtypes: Record<string, string> }>;
  relations: Record<string, { description: string; from: string[]; to: string[] }>;
  examples: { text: string; entities: { type: string; subtype?: string; name: string }[]; relations: { from: string; type: string; to: string }[] }[];
}

export const ontology: Ontology = {
  entities: {
    Person: {
      description: "A named individual, other than the user.",
      subtypes: {
        Employee: "Works at the user's own company: a colleague, manager or report.",
        Contact: "Works at a customer or vendor: someone the user deals with from outside.",
      },
    },
    Organization: {
      description: "A company, team or other group.",
      subtypes: {
        Customer: "A company that buys from the user's company.",
        Vendor: "A company the user's company buys from.",
        Team: "A group inside the user's own company.",
      },
    },
    Object: {
      description: "A thing: a product, document, ticket or piece of equipment.",
      subtypes: {
        Product: "Something the company builds or sells.",
        Document: "A report, runbook, contract or similar.",
        Project: "A named piece of work delivered for a customer.",
        Issue: "A ticket in the tracker, like PLAT-142.",
        Email: "A single email message.",
      },
    },
    Location: {
      description: "A place.",
      subtypes: {
        Office: "A building or site the company works from.",
        City: "A city or town.",
      },
    },
    Event: {
      description: "Something that happens at a time: a meeting, deadline or incident.",
      subtypes: {
        Meeting: "A scheduled get-together.",
        Deadline: "A date something is due.",
        Incident: "Something that went wrong.",
      },
    },
  },
  relations: {
    LIVES_IN: { description: "Where someone lives.", from: ["Person"], to: ["Location"] },
    WORKS_AT: { description: "Who someone works for.", from: ["Person"], to: ["Organization"] },
    KNOWS: { description: "A working or personal relationship between two people, including a manager.", from: ["Person"], to: ["Person"] },
    OWNS: { description: "Who owns or is responsible for something.", from: ["Person", "Organization"], to: ["Object", "Organization"] },
    PARTICIPATES_IN: { description: "Who takes part in an event.", from: ["Person", "Organization"], to: ["Event"] },
    LOCATED_IN: { description: "Where something is.", from: ["Organization", "Object", "Event", "Location"], to: ["Location"] },
    RELATED_TO: { description: "Any other connection. Use only when nothing above fits.", from: [], to: [] }, // empty = any type
  },
  examples: [
    {
      text: "I live in London and I work at Neo4j.",
      entities: [{ type: "Location", subtype: "City", name: "London" }, { type: "Organization", name: "Neo4j" }],
      relations: [{ from: "user", type: "LIVES_IN", to: "London" }, { from: "user", type: "WORKS_AT", to: "Neo4j" }],
    },
    {
      text: "Dana from Contoso is our biggest customer contact.",
      entities: [{ type: "Person", subtype: "Contact", name: "Dana" }, { type: "Organization", subtype: "Customer", name: "Contoso" }],
      relations: [{ from: "Dana", type: "WORKS_AT", to: "Contoso" }],
    },
    {
      text: "My manager Priya is in the platform team.",
      entities: [{ type: "Person", subtype: "Employee", name: "Priya" }, { type: "Organization", subtype: "Team", name: "platform" }],
      relations: [{ from: "user", type: "KNOWS", to: "Priya" }, { from: "Priya", type: "WORKS_AT", to: "platform" }],
    },
  ],
};
