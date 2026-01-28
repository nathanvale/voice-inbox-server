import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const TEST_PORT = 3456

interface TestServer {
	stop: () => void
	port: number
}

let server: TestServer | null = null

beforeAll(async () => {
	// Import and start the server on a test port
	process.env.PORT = String(TEST_PORT)

	// We need to dynamically import to pick up the PORT env var
	// But since the server starts on import, we'll just test the HTTP functions directly
	// by making requests to a test instance

	const { spawn } = await import('bun')
	const proc = spawn(['bun', 'run', 'src/index.ts'], {
		env: { ...process.env, PORT: String(TEST_PORT) },
		cwd: import.meta.dir.replace('/tests', ''),
		stdout: 'pipe',
	})

	// Wait for server to start
	await new Promise((resolve) => setTimeout(resolve, 500))

	server = {
		stop: () => proc.kill(),
		port: TEST_PORT,
	}
})

afterAll(() => {
	server?.stop()
})

const baseUrl = `http://localhost:${TEST_PORT}`

describe('GET /', () => {
	it('returns health check response', async () => {
		const response = await fetch(`${baseUrl}/`)
		expect(response.status).toBe(200)

		const body = await response.json()
		expect(body.status).toBe('ok')
		expect(body.service).toBe('voice-inbox-server')
		expect(body.timestamp).toBeDefined()
	})

	it('includes CORS headers', async () => {
		const response = await fetch(`${baseUrl}/`)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
	})
})

describe('POST /convert', () => {
	it('converts text to note content', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: 'This is a test transcription.' }),
		})

		expect(response.status).toBe(200)

		const body = await response.json()
		expect(body.success).toBe(true)
		expect(body.noteContent).toContain('type: transcription')
		expect(body.noteContent).toContain('source: superwhisper')
		expect(body.noteContent).toContain('This is a test transcription.')
		expect(body.filename).toMatch(/^🎤 \d{4}-\d{2}-\d{2} \d{1,2}-\d{2}[ap]m$/)
	})

	it('accepts custom source', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				text: 'Test with custom source.',
				source: 'ios-dictation',
			}),
		})

		expect(response.status).toBe(200)

		const body = await response.json()
		expect(body.success).toBe(true)
		expect(body.noteContent).toContain('source: ios-dictation')
	})

	it('returns error for missing text', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})

		expect(response.status).toBe(400)

		const body = await response.json()
		expect(body.success).toBe(false)
		expect(body.error).toContain('text')
	})

	it('returns error for empty text', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: '   ' }),
		})

		expect(response.status).toBe(400)

		const body = await response.json()
		expect(body.success).toBe(false)
		expect(body.error).toContain('empty')
	})

	it('returns error for invalid JSON', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json',
		})

		expect(response.status).toBe(400)

		const body = await response.json()
		expect(body.success).toBe(false)
	})

	it('includes CORS headers', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: 'test' }),
		})

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
	})
})

describe('OPTIONS (CORS preflight)', () => {
	it('returns 204 with CORS headers', async () => {
		const response = await fetch(`${baseUrl}/convert`, {
			method: 'OPTIONS',
		})

		expect(response.status).toBe(204)
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
	})
})

describe('404 handling', () => {
	it('returns 404 for unknown routes', async () => {
		const response = await fetch(`${baseUrl}/unknown`)
		expect(response.status).toBe(404)

		const body = await response.json()
		expect(body.success).toBe(false)
		expect(body.error).toBe('Not found')
	})
})
