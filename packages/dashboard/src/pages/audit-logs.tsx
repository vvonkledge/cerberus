import { useEffect, useState } from "react";
import { useApiFetch } from "../api-client";

interface AuditLogEntry {
	id: number;
	eventType: string;
	userId: string | null;
	ipAddress: string | null;
	timestamp: string;
	metadata: string | null;
}

interface Pagination {
	page: number;
	limit: number;
	total: number;
}

interface AuditLogsResponse {
	data: AuditLogEntry[];
	pagination: Pagination;
}

const EVENT_TYPES = [
	"login",
	"login_failed",
	"register",
	"token_refresh",
	"token_revoke",
	"password_reset_requested",
	"password_reset_completed",
	"password_reset_failed",
	"authz_granted",
	"authz_denied",
];

function formatTimestamp(ts: string): string {
	return new Date(ts).toLocaleString();
}

function formatMetadata(metadata: string | null): string {
	if (!metadata) return "—";
	try {
		return JSON.stringify(JSON.parse(metadata), null, 2);
	} catch {
		return metadata;
	}
}

export function AuditLogsPage() {
	const apiFetch = useApiFetch();
	const [entries, setEntries] = useState<AuditLogEntry[]>([]);
	const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [eventType, setEventType] = useState("");

	async function fetchAuditLogs() {
		setLoading(true);
		try {
			const params = new URLSearchParams({ page: String(page) });
			if (eventType) params.set("event_type", eventType);
			const res = await apiFetch(`/audit-logs?${params}`);
			if (!res.ok) throw new Error(`Failed to fetch audit logs: ${res.status}`);
			const json: AuditLogsResponse = await res.json();
			setEntries(json.data);
			setPagination(json.pagination);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch audit logs");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchAuditLogs();
	}, [page, eventType]);

	const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

	if (loading) return <p>Loading audit logs...</p>;

	return (
		<div>
			<h2 className="text-2xl font-bold mb-4">Audit Logs</h2>

			{error && <p className="text-red-600 mb-4">{error}</p>}

			<div className="mb-4">
				<label className="flex items-center gap-2">
					<span className="text-sm text-gray-600">Event Type:</span>
					<select
						value={eventType}
						onChange={(e) => {
							setEventType(e.target.value);
							setPage(1);
						}}
						className="border rounded px-2 py-1"
					>
						<option value="">All</option>
						{EVENT_TYPES.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
				</label>
			</div>

			{entries.length === 0 ? (
				<p className="text-gray-500">No audit log entries found.</p>
			) : (
				<table className="w-full border-collapse">
					<thead>
						<tr className="border-b">
							<th className="text-left p-2">Timestamp</th>
							<th className="text-left p-2">Event Type</th>
							<th className="text-left p-2">User ID</th>
							<th className="text-left p-2">IP Address</th>
							<th className="text-left p-2">Metadata</th>
						</tr>
					</thead>
					<tbody>
						{entries.map((entry) => (
							<tr key={entry.id} className="border-b hover:bg-gray-50">
								<td className="p-2">{formatTimestamp(entry.timestamp)}</td>
								<td className="p-2">{entry.eventType}</td>
								<td className="p-2">{entry.userId || "—"}</td>
								<td className="p-2">{entry.ipAddress || "—"}</td>
								<td className="p-2">
									<pre className="text-xs whitespace-pre-wrap">{formatMetadata(entry.metadata)}</pre>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			<div className="flex items-center gap-4 mt-4">
				<button
					onClick={() => setPage((p) => Math.max(1, p - 1))}
					disabled={page <= 1}
					className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
				>
					Previous
				</button>
				<span className="text-sm text-gray-600">
					Page {page} of {totalPages}
				</span>
				<button
					onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					disabled={page >= totalPages}
					className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</div>
	);
}
