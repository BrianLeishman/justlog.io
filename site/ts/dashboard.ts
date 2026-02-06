import { getEntries } from './api';
import type { Entry } from './api';
import { getAccessToken } from './auth';

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

function renderMcpSetup(): string {
    const token = getAccessToken() ?? '';
    const endpoint = 'https://k24xsd279c.execute-api.us-east-1.amazonaws.com/mcp';

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
                <div class="mb-3">
                    <label class="form-label fw-semibold">Access Token</label>
                    <div class="input-group">
                        <input type="password" class="form-control form-control-sm font-monospace" value="${token}" readonly id="token-field">
                        <button class="btn btn-outline-secondary btn-sm" type="button" id="toggle-token">Show</button>
                        <button class="btn btn-outline-secondary btn-sm" type="button" id="copy-token">Copy</button>
                    </div>
                    <div class="form-text">This token expires after 1 hour. Sign out and back in to get a new one.</div>
                </div>
            </div>
        </div>`;
}

function bindMcpButtons(): void {
    document.getElementById('copy-endpoint')?.addEventListener('click', () => {
        const input = document.querySelector('#copy-endpoint')?.parentElement?.querySelector('input');
        if (input) {
            void navigator.clipboard.writeText(input.value);
        }
    });

    document.getElementById('copy-token')?.addEventListener('click', () => {
        const input = document.getElementById('token-field') as HTMLInputElement | null;
        if (input) {
            void navigator.clipboard.writeText(input.value);
        }
    });

    document.getElementById('toggle-token')?.addEventListener('click', () => {
        const input = document.getElementById('token-field') as HTMLInputElement | null;
        const btn = document.getElementById('toggle-token');
        if (input && btn) {
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.textContent = isHidden ? 'Hide' : 'Show';
        }
    });
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
    container.innerHTML = '<p class="text-body-secondary">Loading...</p>';

    const today = new Date().toISOString().split('T')[0];
    const [food, exercise, weight] = await Promise.all([
        getEntries('food', today, today),
        getEntries('exercise', today, today),
        getEntries('weight', today, today),
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
                ${renderMcpSetup()}
            </div>
        </div>`;

    bindMcpButtons();
}
