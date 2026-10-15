import { z } from 'zod';

// `available` is the registry's own catalogue of mapper names — the same
// `ClaimMapperRegistry` the issuance path assembles claims from — and
// `bound` is this scope's own override, empty when the scope has no
// binding rows and falls back to its declared mappers. `declared` names
// those: the mappers that declare this scope, which are what issuance runs
// while `bound` is empty. It comes from code, so no write changes it and the
// `ETag` does not cover it.
export const scopeMappersSchema = z.object({
  available: z.array(z.string()),
  bound: z.array(z.string()),
  declared: z.array(z.string()),
});
export type ScopeMappers = z.infer<typeof scopeMappersSchema>;

export const setScopeMappersRequestSchema = z.object({
  mapper_names: z.array(z.string()),
});
export type SetScopeMappersRequest = z.infer<typeof setScopeMappersRequestSchema>;
