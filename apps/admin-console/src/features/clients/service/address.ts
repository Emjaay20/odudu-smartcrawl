import { resourceAddress } from '#/shared/service/address';

const clients = resourceAddress({ segment: 'clients', group: 'Applications', label: 'Clients' });

export const {
  listHref: clientsHref,
  newHref: newClientHref,
  recordHref: clientHref,
  trail: clientsTrail,
} = clients;
