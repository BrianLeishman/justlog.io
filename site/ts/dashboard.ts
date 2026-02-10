import { Chart, registerables } from 'chart.js';
import * as bootstrap from 'bootstrap';
import { getEntries, api } from './api';
import { logout, getApiKeyId } from './auth';
import type { Entry } from './api';

Chart.register(...registerables);

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
    let totalCal = 0, totalP = 0, totalC = 0, totalFat = 0, totalFiber = 0, totalCaff = 0, totalChol = 0;

    const rows = entries.map(e => {
        totalCal += e.calories || 0;
        totalP += e.protein || 0;
        totalC += e.carbs || 0;
        totalFat += e.fat || 0;
        totalFiber += e.fiber || 0;
        totalCaff += e.caffeine || 0;
        totalChol += e.cholesterol || 0;
        return `<tr>
            <td>${formatTime(e.created_at)}</td>
            <td>${e.description}</td>
            <td class="text-end">${num(e.calories)}</td>
            <td class="text-end">${num(e.protein)}</td>
            <td class="text-end">${num(e.carbs)}</td>
            <td class="text-end">${num(e.fat)}</td>
            <td class="text-end">${num(e.fiber)}</td>
            <td class="text-end">${num(e.caffeine)}</td>
            <td class="text-end">${num(e.cholesterol)}</td>
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
                    <th class="text-end">Caffeine</th>
                    <th class="text-end">Chol</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr class="fw-bold">
                    <td></td>
                    <td>Total</td>
                    <td class="text-end">${num(totalCal)}</td>
                    <td class="text-end">${totalP ? num(totalP) + 'g' : '-'}</td>
                    <td class="text-end">${totalC ? num(totalC) + 'g' : '-'}</td>
                    <td class="text-end">${totalFat ? num(totalFat) + 'g' : '-'}</td>
                    <td class="text-end">${totalFiber ? num(totalFiber) + 'g' : '-'}</td>
                    <td class="text-end">${totalCaff ? num(totalCaff) + 'mg' : '-'}</td>
                    <td class="text-end">${totalChol ? num(totalChol) + 'mg' : '-'}</td>
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
        <td>${formatTime(e.created_at)}</td>
        <td>${e.description}</td>
        <td class="text-end">${num(e.duration)}</td>
        <td class="text-end">${num(e.calories)}</td>
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

const weightFmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function renderWeightTable(entries: Entry[]): string {
    if (entries.length === 0) {
        return '<p class="text-body-secondary">No weight logged today.</p>';
    }

    const rows = entries.map(e => `<tr>
        <td>${formatTime(e.created_at)}</td>
        <td class="text-end">${weightFmt.format(e.value)}</td>
        <td>${e.unit || 'lbs'}</td>
        <td class="text-body-secondary">${e.notes || ''}</td>
    </tr>`).join('');

    return `
        <div class="table-responsive">
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Time</th>
                    <th class="text-end">Weight</th>
                    <th>Unit</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        </div>`;
}

function renderWeightChart(history: Entry[]): void {
    const canvas = document.getElementById('weight-chart') as HTMLCanvasElement | null;
    if (!canvas) {
        return;
    }

    // Build a map of day -> latest entry
    const byDay = new Map<string, Entry>();
    for (const e of history) {
        const day = fmtDate(new Date(e.created_at));
        const existing = byDay.get(day);
        if (!existing || e.created_at > existing.created_at) {
            byDay.set(day, e);
        }
    }

    // Generate all 30 days as labels, with null for missing days
    const labels: string[] = [];
    const data: (number | null)[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const entry = byDay.get(key);
        data.push(entry ? entry.value : null);
    }

    const style = getComputedStyle(document.documentElement);
    const primary = style.getPropertyValue('--bs-primary').trim() || '#0d6efd';
    const textColor = style.getPropertyValue('--bs-body-color').trim() || '#dee2e6';
    const gridColor = style.getPropertyValue('--bs-border-color').trim() || '#495057';

    new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Weight',
                data,
                borderColor: primary,
                backgroundColor: primary + '33',
                pointRadius: 5,
                pointBackgroundColor: primary,
                showLine: true,
                spanGaps: true,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor,
                        callback: v => weightFmt.format(v as number),
                    },
                    grid: { color: gridColor },
                },
            },
        },
    });
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
    const isCurrentSession = key.key_id === getApiKeyId();
    let badge = '';
    let actionBtn: string;
    if (isCurrentSession) {
        badge = ' <span class="badge text-bg-secondary">current session</span>';
        actionBtn = `<button class="btn btn-outline-warning btn-sm delete-key-btn" data-key-id="${key.key_id}" data-is-session="true" data-bs-toggle="tooltip" data-bs-title="This will log you out">Revoke session</button>`;
    } else {
        actionBtn = `<button class="btn btn-outline-danger btn-sm delete-key-btn" data-key-id="${key.key_id}">Revoke</button>`;
    }
    return `<tr data-key-id="${key.key_id}">
        <td>${key.label || 'Untitled'}${badge}</td>
        <td class="text-body-secondary">${created}</td>
        <td class="text-end">${actionBtn}</td>
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

function copyWithFeedback(btn: HTMLElement, text: string): void {
    void navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = orig;
        }, 1500);
    });
}

function bindMcpButtons(refreshDashboard: () => Promise<void>): void {
    document.getElementById('copy-endpoint')?.addEventListener('click', e => {
        const btn = e.currentTarget as HTMLElement;
        const input = btn.parentElement?.querySelector('input');
        if (input) {
            copyWithFeedback(btn, input.value);
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

    document.getElementById('copy-new-key')?.addEventListener('click', e => {
        const value = document.getElementById('new-key-value');
        if (value?.textContent) {
            copyWithFeedback(e.currentTarget as HTMLElement, value.textContent);
        }
    });

    // Initialize Bootstrap tooltips
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el);
    });

    document.querySelectorAll('.delete-key-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const el = btn as HTMLElement;
            const keyId = el.dataset.keyId;
            if (!keyId) {
                return;
            }
            const isSession = el.dataset.isSession === 'true';
            const msg = isSession
                ? 'Revoke your current session? You will be logged out.'
                : 'Revoke this API key? Any integrations using it will stop working.';
            if (!confirm(msg)) {
                return;
            }
            await deleteAPIKey(keyId);
            if (isSession) {
                logout();
                window.location.reload();
                return;
            }
            await refreshDashboard();
        });
    });
}

function fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let selectedDate: Date = new Date();

export async function renderDashboard(container: HTMLElement): Promise<void> {
    container.innerHTML = '<p class="text-body-secondary">Loading...</p>';

    const now = new Date();
    const today = fmtDate(selectedDate);
    const isToday = fmtDate(now) === today;
    const realToday = fmtDate(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = fmtDate(yesterday);
    const ago = new Date(now);
    ago.setDate(ago.getDate() - 30);
    const thirtyDaysAgo = fmtDate(ago);
    const ago7 = new Date(now);
    ago7.setDate(ago7.getDate() - 7);
    const sevenDaysAgo = fmtDate(ago7);
    const [food, exercise, weight, weightHistory, food7, food30, keys] = await Promise.all([
        getEntries('food', today, today),
        getEntries('exercise', today, today),
        getEntries('weight', today, today),
        getEntries('weight', thirtyDaysAgo, realToday),
        getEntries('food', sevenDaysAgo, yesterdayStr),
        getEntries('food', thirtyDaysAgo, yesterdayStr),
        fetchAPIKeys(),
    ]);

    const localDate = (iso: string) => fmtDate(new Date(iso));
    const todayCal = food.reduce((s, e) => s + Number(e.calories || 0), 0);
    const days7WithCal = new Set(food7.filter(e => Number(e.calories || 0) > 0).map(e => localDate(e.created_at))).size;
    const avg7Cal = days7WithCal > 0 ? food7.reduce((s, e) => s + Number(e.calories || 0), 0) / days7WithCal : 0;
    const days30WithCal = new Set(food30.filter(e => Number(e.calories || 0) > 0).map(e => localDate(e.created_at))).size;
    const avg30Cal = days30WithCal > 0 ? food30.reduce((s, e) => s + Number(e.calories || 0), 0) / days30WithCal : 0;

    const displayDate = selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-center gap-3 mb-4">
            <button class="btn btn-outline-secondary btn-sm" id="date-prev" aria-label="Previous day"><i class="fa-solid fa-chevron-left"></i></button>
            <input type="date" class="form-control form-control-sm" id="date-picker" value="${today}" max="${fmtDate(now)}" style="width:auto;">
            <button class="btn btn-outline-secondary btn-sm" id="date-next" aria-label="Next day" ${isToday ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
            ${isToday ? '' : '<button class=\'btn btn-outline-primary btn-sm\' id=\'date-today\'>Today</button>'}
        </div>
        <div class="row g-4">
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-body-secondary small">Calories ${isToday ? 'Today' : displayDate}</div>
                        <div class="fs-2 fw-bold">${todayCal > 0 ? numFmt.format(Math.round(todayCal)) : '-'}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-body-secondary small">Avg Cal / Day (7d) <span class="badge rounded-pill text-bg-secondary" data-bs-toggle="tooltip" data-bs-title="Average of the previous 7 days, excluding today" style="cursor:help; font-size:.6em; vertical-align:middle;">i</span></div>
                        <div class="fs-2 fw-bold">${avg7Cal > 0 ? numFmt.format(Math.round(avg7Cal)) : '-'}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card text-center">
                    <div class="card-body">
                        <div class="text-body-secondary small">Avg Cal / Day (30d) <span class="badge rounded-pill text-bg-secondary" data-bs-toggle="tooltip" data-bs-title="Average of the previous 30 days, excluding today" style="cursor:help; font-size:.6em; vertical-align:middle;">i</span></div>
                        <div class="fs-2 fw-bold">${avg30Cal > 0 ? numFmt.format(Math.round(avg30Cal)) : '-'}</div>
                    </div>
                </div>
            </div>
            <div class="col-12">
                <h4>Food</h4>
                ${food.length > 0 ? renderFoodTable(food) : `<p class="text-body-secondary">No food logged ${isToday ? 'today' : 'this day'}.</p>`}
            </div>
            <div class="col-md-6">
                <h4>Exercise</h4>
                ${renderExerciseTable(exercise)}
            </div>
            <div class="col-md-6">
                <h4>Weight</h4>
                ${renderWeightTable(weight)}
            </div>
            <div class="col-12">
                <h4>Weight Trend</h4>
                <canvas id="weight-chart" height="100"></canvas>
            </div>
            <div class="col-12 mt-4">
                ${renderMcpSetup(keys)}
            </div>
        </div>`;

    renderWeightChart(weightHistory);
    bindMcpButtons(() => renderDashboard(container));

    // Date navigation
    const refresh = async () => renderDashboard(container);
    document.getElementById('date-prev')?.addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        void refresh();
    });
    document.getElementById('date-next')?.addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        void refresh();
    });
    document.getElementById('date-today')?.addEventListener('click', () => {
        selectedDate = new Date();
        void refresh();
    });
    document.getElementById('date-picker')?.addEventListener('change', e => {
        const val = (e.target as HTMLInputElement).value;
        if (val) {
            const [y, m, d] = val.split('-').map(Number);
            selectedDate = new Date(y, m - 1, d);
            void refresh();
        }
    });
}
