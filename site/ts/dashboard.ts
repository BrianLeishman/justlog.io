import { getEntries, api } from './api';
import type { Entry } from './api';

interface APIKeyInfo {
    key_id: string;
    label: string;
    created_at: string;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const numFmt = new Intl.NumberFormat();

function num(v: number): string {
    return v ? numFmt.format(Math.round(v)) : '-';
}

function renderFoodTable(entries: Entry[]): string {
    let totalCal = 0, totalP = 0, totalC = 0, totalFat = 0, totalFiber = 0;

    const rows = entries.map(e => {
        totalCal += e.Calories;
        totalP += e.Protein;
        totalC += e.Carbs;
        totalFat += e.Fat;
        totalFiber += e.Fiber;
        return `<tr>
            <td>${formatTime(e.CreatedAt)}</td>
            <td>${e.Description}</td>
            <td class="text-end">${num(e.Calories)}</td>
            <td class="text-end">${num(e.Protein)}</td>
            <td class="text-end">${num(e.Carbs)}</td>
            <td class="text-end">${num(e.Fat)}</td>
            <td class="text-end">${num(e.Fiber)}</td>
        </tr>`;
    }).join('');

    return `
        <div class="table-responsive">
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Food</th>
                    <th class="text-end">Cal</th>
                    <th class="text-end">Protein</th>
                    <th class="text-end">Carbs</th>
                    <th class="text-end">Fat</th>
                    <th class="text-end">Fiber</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr class="fw-bold">
                    <td></td>
                    <td>Total</td>
                    <td class="text-end">${num(totalCal)}</td>
                    <td class="text-end">${num(totalP)}g</td>
                    <td class="text-end">${num(totalC)}g</td>
                    <td class="text-end">${num(totalFat)}g</td>
                    <td class="text-end">${num(totalFiber)}g</td>
                </tr>
            </tfoot>
        </table>
        </div>`;
}

function renderExerciseTable(entries: Entry[]): string {
    if (entries.length === 0) {
        return '<p class="text-body-secondary">No exercise logged today.</p>';
    }

    const rows = entries.map(e => `<tr>
        <td>${formatTime(e.CreatedAt)}</td>
        <td>${e.Description}</td>
        <td class="text-end">${num(e.Duration)}</td>
        <td class="text-end">${num(e.Calories)}</td>
    </tr>`).join('');

    return `
        <div class="table-responsive">
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Exercise</th>
                    <th class="text-end">Min</th>
                    <th class="text-end">Cal burned</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        </div>`;
}

function renderWeight(entries: Entry[]): string {
    if (entries.length === 0) {
        return '<p class="text-body-secondary">No weight logged today.</p>';
    }

    const latest = entries[0];
    const weightFmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `<p class="fs-4 fw-bold mb-0">${weightFmt.format(latest.Value)} ${latest.Unit || 'lbs'}</p>
            <p class="text-body-secondary">${formatTime(latest.CreatedAt)}</p>`;
}

async function fetchAPIKeys(): Promise<APIKeyInfo[]> {
    try {
        const { data } = await api.get<APIKeyInfo[]>('/api/token');
        return data ?? [];
    } catch {
        return [];
    }
}

async function createAPIKey(label: string): Promise<{ api_key: string; key_id: string } | null> {
    try {
        const { data } = await api.post<{ api_key: string; key_id: string }>('/api/token', { label });
        return data;
    } catch {
        return null;
    }
}

async function deleteAPIKey(keyId: string): Promise<boolean> {
    try {
        await api.delete('/api/token', { params: { id: keyId } });
        return true;
    } catch {
        return false;
    }
}

function renderKeyRow(key: APIKeyInfo): string {
    const created = new Date(key.created_at).toLocaleDateString();
    const isWebUI = key.label === 'Web UI';
    return `<tr data-key-id="${key.key_id}">
        <td>${key.label || 'Untitled'}${isWebUI ? ' <span class="badge text-bg-secondary">browser</span>' : ''}</td>
        <td class="text-body-secondary">${created}</td>
        <td class="text-end">
            ${isWebUI ? '' : `<button class="btn btn-outline-danger btn-sm delete-key-btn" data-key-id="${key.key_id}">Revoke</button>`}
        </td>
    </tr>`;
}

function renderMcpSetup(keys: APIKeyInfo[]): string {
    const endpoint = 'https://k24xsd279c.execute-api.us-east-1.amazonaws.com/mcp';

    const keyRows = keys.length > 0
        ? keys.map(renderKeyRow).join('')
        : '<tr><td colspan="3" class="text-body-secondary">No API keys yet.</td></tr>';

    return `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">MCP Setup</h5>
                <p class="card-text">Connect your AI assistant to JustLog using the MCP protocol.</p>
                <div class="mb-3">
                    <label class="form-label fw-semibold">Endpoint</label>
                    <div class="input-group">
                        <input type="text" class="form-control form-control-sm font-monospace" value="${endpoint}" readonly>
                        <button class="btn btn-outline-secondary btn-sm" type="button" id="copy-endpoint">Copy</button>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="form-label fw-semibold">API Keys</label>
                    <table class="table table-sm mb-2">
                        <thead><tr><th>Label</th><th>Created</th><th></th></tr></thead>
                        <tbody id="api-keys-tbody">${keyRows}</tbody>
                    </table>
                    <div id="new-key-alert" class="d-none alert alert-success alert-dismissible mb-2">
                        <strong>New key created:</strong> <code id="new-key-value"></code>
                        <button class="btn btn-outline-success btn-sm ms-2" id="copy-new-key">Copy</button>
                        <div class="form-text mt-1">Save this key now — it won't be shown again.</div>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                    <div class="input-group input-group-sm">
                        <input type="text" class="form-control" placeholder="Key label (e.g. Claude Code)" id="new-key-label">
                        <button class="btn btn-primary" type="button" id="create-key-btn">Create Key</button>
                    </div>
                </div>
            </div>
        </div>`;
}

function bindMcpButtons(refreshDashboard: () => Promise<void>): void {
    document.getElementById('copy-endpoint')?.addEventListener('click', () => {
        const input = document.querySelector('#copy-endpoint')?.parentElement?.querySelector('input');
        if (input) {
            void navigator.clipboard.writeText(input.value);
        }
    });

    document.getElementById('create-key-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('new-key-label') as HTMLInputElement | null;
        const label = input?.value.trim() || 'Untitled';
        const result = await createAPIKey(label);
        if (!result) {
            return;
        }

        if (!localStorage.getItem('api_key')) {
            localStorage.setItem('api_key', result.api_key);
        }

        // Refresh first, then show the key (refresh re-renders the DOM)
        await refreshDashboard();

        const alertEl = document.getElementById('new-key-alert');
        const value = document.getElementById('new-key-value');
        if (alertEl && value) {
            value.textContent = result.api_key;
            alertEl.classList.remove('d-none');
        }
    });

    document.getElementById('copy-new-key')?.addEventListener('click', () => {
        const value = document.getElementById('new-key-value');
        if (value?.textContent) {
            void navigator.clipboard.writeText(value.textContent);
        }
    });

    document.querySelectorAll('.delete-key-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const keyId = (btn as HTMLElement).dataset.keyId;
            if (!keyId) {
                return;
            }
            if (!confirm('Revoke this API key? Any integrations using it will stop working.')) {
                return;
            }
            await deleteAPIKey(keyId);
            await refreshDashboard();
        });
    });
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
    container.innerHTML = '<p class="text-body-secondary">Loading...</p>';

    const today = new Date().toISOString().split('T')[0];
    const [food, exercise, weight, keys] = await Promise.all([
        getEntries('food', today, today),
        getEntries('exercise', today, today),
        getEntries('weight', today, today),
        fetchAPIKeys(),
    ]);

    container.innerHTML = `
        <div class="row g-4">
            <div class="col-12">
                <h4>Food</h4>
                ${food.length > 0 ? renderFoodTable(food) : '<p class="text-body-secondary">No food logged today. Tell your AI assistant what you ate!</p>'}
            </div>
            <div class="col-md-6">
                <h4>Exercise</h4>
                ${renderExerciseTable(exercise)}
            </div>
            <div class="col-md-6">
                <h4>Weight</h4>
                ${renderWeight(weight)}
            </div>
            <div class="col-12 mt-4">
                ${renderMcpSetup(keys)}
            </div>
        </div>`;

    bindMcpButtons(() => renderDashboard(container));
}
