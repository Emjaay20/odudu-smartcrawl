import { useMutation } from '@tanstack/react-query';
import { createTenant } from '#/features/tenants/adapter/tenants';
import { readFileText } from '#/features/tenants/adapter/files';

export function useCreate(gateway: unknown) {
  return useMutation({
    mutationFn: async (input: { name: string; file: File }) =>
      createTenant(gateway, { name: input.name, text: await readFileText(input.file) }),
  });
}
