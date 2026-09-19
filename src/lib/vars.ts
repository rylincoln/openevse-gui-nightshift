export interface EvseClient {
	id: number
	priority: number
}

// clientid2name (utils.ts) looks up a client's key by scanning every entry's
// `id` for a match, so this needs a plain string index — not `as const`.
export const EvseClients: Record<string, EvseClient> = {
	manual: { id: 65537, priority: 1000 },
	divert: { id: 65538, priority: 50 },
	boost: 	{ id: 65539, priority: 200},
	timer: 	{ id: 65540, priority: 100},
	limit:  { id: 65542, priority: 1100},
	error:	{ id: 65543, priority: 10000},
	ocpp:	{ id: 65545, priority: 1050},
	rfid:	{ id: 65546, priority: 1030},
	mqtt: 	{ id: 65547, priority: 500},
	shaper: { id: 65548, priority: 5000},
	loadsharing: { id: 0x0001000E, priority: 5000},
	tempThrottle: { id: 0x0001000D, priority: 10000}

}
