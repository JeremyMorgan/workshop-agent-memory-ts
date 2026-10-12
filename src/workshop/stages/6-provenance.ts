// STAGE 6: memory poisoning and provenance.
// Flags: provenance, trustFilter. Source/trust are stamped by code on every fact; low-trust facts are
// withheld from payment/account questions.
import { resolveProvenance } from "../graph/provenance.js";
import { filterFacts } from "../processors/trustFilter.js";
import { memoryPolicies } from "../tools/memory.js";
import type { Stage } from "./types.js";

export const stage6: Stage = {
  setup: () => {
    memoryPolicies.provenance = resolveProvenance;
    memoryPolicies.trustFilter = filterFacts;
  },
};
