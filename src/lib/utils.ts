import {_} 					from 'svelte-i18n'
import {DateTime} 			from "luxon";
import {EvseClients}		from "./vars"
import {get} 				from 'svelte/store'


export const removeDuplicateObjects = <T>(array: T[], key: keyof T): T[] => {
    const set = new Set<T[keyof T]>()

    return array.filter(item => {
        const alreadyHas = set.has(item[key])
        set.add(item[key])

        return !alreadyHas
    })
}

export function sec2time(sec: number | null | undefined): string {
	if (!sec)
		sec = 0
	const hours = Math.floor(sec / 3600)
	sec %= 3600
	const minutes = Math.floor(sec / 60);
	const seconds = sec % 60;
	return hours.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false }) + ':' + minutes.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false }) + ':' + seconds.toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false })
}

export function formatDate(t: string, z?: string, format?: string | null): string {
	let d
	if (z) {
		let tz = z.split("|")[0]
		d = DateTime.fromISO(t, {zone: tz})
	}
	else d = DateTime.fromISO(t)
	const arr = d.toLocaleString(DateTime.DATETIME_SHORT).split(" ")
	let datearr = arr[0].split("/")
	if (format=="short") {
		//remove year
		datearr.pop()
	}
	// fixing missing trailing 0 luxxon bug on US locale
	datearr[0] = datearr[0]?.length == 1?"0"+datearr[0]:datearr[0]
	datearr[1] = datearr[1]?.length == 1?"0"+datearr[1]:datearr[1]
	const date = datearr.join("/")
	let time = arr[1]
	if (arr[2])
		time += " " + arr[2]

	return date + " " + time
}

export function displayTime(t: string): string {
	const d = DateTime.fromISO(t).toLocaleString(DateTime.TIME_SIMPLE)
	return d
}

export function getTZ(s: string | null | undefined): string {
	if(s)
		return s.split('|')[0]
	else
		return "UTC"
}

export function createTzObj(tz: Record<string, string>): { name: string; value: string }[] {
	var tzobj: { name: string; value: string }[] = []
	let idx = 0
	Object.entries(tz).forEach((element) => {
		if (!element[0].startsWith("Etc")) {
			tzobj[idx] = { name: element[0], value: element[0] + "|" + element[1] }
			idx++
		}
		else {
		}
	})
	return tzobj
}

// Human-readable byte size. ESP flash/partition sizes are powers of two, so a
// 16 MB chip (16777216 bytes) renders as "16 MB" without rounding artefacts.
export function formatBytes(bytes: number | undefined | null, decimals = 1): string {
	if (bytes === undefined || bytes === null || isNaN(bytes)) return '—'
	if (bytes === 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
	const value = bytes / Math.pow(k, i)
	// Whole bytes have no fraction; larger units trim trailing zeros.
	return (i === 0 ? value : parseFloat(value.toFixed(decimals))) + ' ' + sizes[i]
}

export function round(value: number, precision: number | null = null): number {
	var multiplier = Math.pow(10, precision || 0);
	return Math.round(value * multiplier) / multiplier;
}

export function temp_round(value: number | undefined): number | string {
	const n = Number(value)
	if (isNaN(n)) {
		return ""
	}
	return round(n/10,1)
}

export let getBreakpoint = function (): 'mobilemini' | 'mobile' | 'tablet' | 'desktop' | 'unknown' {
	const mobilemini = 410
    const mobile = 640
    const tablet = 1280
    //const desktop = 1440
    var bp: 'mobilemini' | 'mobile' | 'tablet' | 'desktop' | 'unknown'
    if (window.innerWidth <= mobilemini) bp = "mobilemini"
	else if (window.innerWidth > mobilemini && window.innerWidth <= mobile) bp = "mobile"
    else if (window.innerWidth > mobile && window.innerWidth <= tablet) bp = "tablet"
    else if (window.innerWidth > tablet) bp="desktop"
    else bp="unknown"

    return bp;
};

export function clientid2name(id: number | null | undefined): string {
	let output = "null"
	Object.keys(EvseClients).forEach(key => {
		if (id == EvseClients[key].id) {
			output = key
		}
	})
	return output
}

export function getStateDesc(state: number | undefined): string | undefined {
	switch (state) {
		case 0: return get(_)("logs-states.loading")
		case 1: return get(_)("logs-states.active-nocar")
		case 2: return get(_)("logs-states.active-car")
		case 3: return get(_)("logs-states.active-charge")
		// Errors
		case 4: return get(_)("logs-states.error-vent")
		case 5: return get(_)("logs-states.error-diode")
		case 6: return get(_)("logs-states.error-gfi")
		case 7: return get(_)("logs-states.error-ground")
		case 8: return get(_)("logs-states.error-relay")
		case 9: return get(_)("logs-states.error-gfitest")
		case 10: return get(_)("logs-states.error-temp")
		case 11: return get(_)("logs-states.error-current")
		// Disabled
		case 254: return get(_)("logs-states.sleeping")
		case 255: return get(_)("logs-states.disabled")
	}
}

export function dedup<T>(arr: T[]): T[] {
	var hashTable: Record<string, boolean> = {};

	return arr.filter(function (el) {
		var key = JSON.stringify(el);
		var match = Boolean(hashTable[key]);

		return (match ? false : hashTable[key] = true);
	});
}

// export function s2mns(s){return(s-(s%=60))/60+(9<s?'mn ':'mn 0')+s+'s'}

export function s2mns(s: number): string {
	return new Date(s * 1000).toISOString().slice(11, 19);
}


export function miles2km(d: number): number {
	return d * 1.60934
}

export function isFloat(n: number): boolean {
	return n === +n && n !== (n|0);
}

export function isInteger(n: number): boolean {
    return n === +n && n === (n|0);
}

export function JSONTryParse(input: string | null | undefined): Record<string, unknown> | false {
	try {
		//check if the string exists
		if (input) {
			var o: unknown = JSON.parse(input);

			//validate the result too
			if (o && typeof o === 'object' && o.constructor === Object) {
				return o as Record<string, unknown>;
			}
		}
	}
	catch {
	}
	return false;
};

export function compareVersion(last: unknown, old: unknown): number {
	if (typeof last !== 'string') return 0
	if (typeof old !== 'string') return 0
	let lastStr = last
	let oldStr = old
	if (lastStr[0] == "v") {
		lastStr = lastStr.substring(1)
	}
	if (oldStr[0] == "v") {
		oldStr = oldStr.substring(1)
	}
	else return 0
	const lastParts = lastStr.split('.').map((n) => parseInt(n, 10))
	const oldParts = oldStr.split('.').map((n) => parseInt(n, 10))
	const k = Math.min(lastParts.length, oldParts.length)
	for (let i = 0; i < k; ++i) {
		if (lastParts[i] > oldParts[i]) return 1
		if (lastParts[i] < oldParts[i]) return -1
	}
	return lastParts.length == oldParts.length ? 0 : (lastParts.length < oldParts.length ? -1 : 1)
}

/**
 * The controller's hardware current ceiling, or a guess when the firmware
 * has not learned it yet. GET /config reports max_current_hard straight from
 * evse.getMaxHardwareCurrent(), which is 0 until the ESP has read $GC from the
 * controller (and in the mock fixture) — treated as a real ceiling, that 0
 * collapses every slider and cap that uses it to nothing.
 *
 * The guess is `fallback`, raised to max_current_soft when that is higher:
 * the firmware caps the soft limit at the hardware ceiling, so a soft limit
 * it has already accepted is proof the hardware allows at least that much.
 * Without this the Charge Manager slider showed 48 A on a 0–32 A track.
 */
export function hardMaxCurrent(
  config?: { max_current_hard?: unknown; max_current_soft?: unknown },
  fallback = 32,
): number {
  const hard = Number(config?.max_current_hard)
  if (Number.isFinite(hard) && hard > 0) return hard
  const soft = Number(config?.max_current_soft)
  return Number.isFinite(soft) && soft > fallback ? soft : fallback
}
