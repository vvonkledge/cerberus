function hexEncode(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function hexDecode(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array | string): string {
	const bytes =
		typeof data === "string"
			? new TextEncoder().encode(data)
			: new Uint8Array(data);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derived = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		256,
	);
	return `${hexEncode(salt)}:${hexEncode(derived)}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(":");
	const salt = hexDecode(saltHex);
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const derived = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		256,
	);
	return hexEncode(derived) === hashHex;
}

export async function signJwt(
	payload: { sub: string; [key: string]: unknown },
	secret: string,
	expiresInSeconds = 3600,
): Promise<string> {
	const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const now = Math.floor(Date.now() / 1000);
	const claims = {
		...payload,
		iat: now,
		exp: now + expiresInSeconds,
	};
	const body = base64UrlEncode(JSON.stringify(claims));
	const signingInput = `${header}.${body}`;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(signingInput),
	);

	return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyJwt(
	token: string,
	secret: string,
): Promise<{ sub: string; iat: number; exp: number } | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;

	const [header, body, sig] = parts;
	const signingInput = `${header}.${body}`;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);

	const signatureBytes = base64UrlDecode(sig);
	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		signatureBytes,
		new TextEncoder().encode(signingInput),
	);
	if (!valid) return null;

	const payload = JSON.parse(
		new TextDecoder().decode(base64UrlDecode(body)),
	) as { sub: string; iat: number; exp: number };

	if (payload.exp < Math.floor(Date.now() / 1000)) return null;

	return payload;
}
