/**
 * Voice Inbox Server
 *
 * HTTP server that accepts voice transcriptions from iOS Shortcuts
 * and returns formatted Obsidian note content for clipboard-based
 * Advanced URI creation.
 *
 * Endpoints:
 * - GET /        Health check
 * - POST /convert  Convert transcription to Obsidian note format
 */

const PORT = process.env.PORT || 3000

interface ConvertRequest {
	text: string
	source?: string
}

interface ConvertResponse {
	success: boolean
	noteContent: string
	filename: string
}

interface ErrorResponse {
	success: false
	error: string
}

/**
 * Generate a human-readable timestamp for filenames.
 * Format: "2026-01-28 2-51pm"
 */
function generateTimestamp(): string {
	const now = new Date()

	const year = now.getFullYear()
	const month = String(now.getMonth() + 1).padStart(2, '0')
	const day = String(now.getDate()).padStart(2, '0')

	let hours = now.getHours()
	const minutes = String(now.getMinutes()).padStart(2, '0')
	const ampm = hours >= 12 ? 'pm' : 'am'
	hours = hours % 12
	hours = hours || 12 // Convert 0 to 12

	return `${year}-${month}-${day} ${hours}-${minutes}${ampm}`
}

/**
 * Generate the note filename with emoji prefix.
 * Format: "🎤 2026-01-28 2-51pm"
 */
function generateFilename(): string {
	return `🎤 ${generateTimestamp()}`
}

/**
 * Generate frontmatter for the transcription note.
 */
function generateFrontmatter(source: string): string {
	const today = new Date().toISOString().split('T')[0]

	return `---
type: transcription
created: ${today}
source: ${source}
template_version: 1
areas: []
projects: []
summary: ""
---`
}

/**
 * Generate the complete note content.
 */
function generateNoteContent(text: string, source: string): string {
	const frontmatter = generateFrontmatter(source)
	return `${frontmatter}

${text}
`
}

/**
 * Handle POST /convert requests.
 */
async function handleConvert(
	request: Request,
): Promise<ConvertResponse | ErrorResponse> {
	try {
		const body = (await request.json()) as ConvertRequest

		if (!body.text || typeof body.text !== 'string') {
			return {
				success: false,
				error: 'Missing or invalid "text" field',
			}
		}

		const text = body.text.trim()
		if (text.length === 0) {
			return {
				success: false,
				error: 'Text cannot be empty',
			}
		}

		const source = body.source || 'superwhisper'
		const noteContent = generateNoteContent(text, source)
		const filename = generateFilename()

		return {
			success: true,
			noteContent,
			filename,
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to parse request',
		}
	}
}

/**
 * Main request handler.
 */
async function handler(request: Request): Promise<Response> {
	const url = new URL(request.url)
	const { pathname } = url
	const method = request.method

	// CORS headers for iOS Shortcuts
	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	}

	// Handle preflight
	if (method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders,
		})
	}

	// Health check
	if (pathname === '/' && method === 'GET') {
		return new Response(
			JSON.stringify({
				status: 'ok',
				service: 'voice-inbox-server',
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders,
				},
			},
		)
	}

	// Convert endpoint
	if (pathname === '/convert' && method === 'POST') {
		const result = await handleConvert(request)
		const status = result.success ? 200 : 400

		return new Response(JSON.stringify(result), {
			status,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders,
			},
		})
	}

	// 404 for everything else
	return new Response(
		JSON.stringify({
			success: false,
			error: 'Not found',
		}),
		{
			status: 404,
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders,
			},
		},
	)
}

// Start server
const server = Bun.serve({
	port: PORT,
	fetch: handler,
})

console.log(`🎤 Voice Inbox Server running on http://localhost:${server.port}`)
