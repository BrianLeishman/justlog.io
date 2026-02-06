import { handleCallback, getUser, login, logout } from './auth';
import { renderDashboard } from './dashboard';

async function init(): Promise<void> {
    // Handle OAuth callback
    if (window.location.pathname === '/auth/callback/') {
        const ok = await handleCallback();
        if (ok) {
            window.location.href = '/';
            return;
        }
    }

    // Render auth state in navbar
    const authContainer = document.getElementById('auth');
    if (!authContainer) {
        return;
    }

    const user = getUser();
    if (user) {
        authContainer.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <img src="${user.picture}" alt="" class="rounded-circle" width="28" height="28" referrerpolicy="no-referrer">
                <span class="d-none d-sm-inline">${user.name}</span>
                <button class="btn btn-sm btn-outline-secondary" id="logout-btn">Sign out</button>
            </div>
        `;
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            logout();
            window.location.href = '/';
        });

        // Render dashboard
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            void renderDashboard(dashboard);
        }
    } else {
        authContainer.innerHTML = `
            <button class="btn btn-sm btn-primary" id="login-btn">Sign in with Google</button>
        `;
        document.getElementById('login-btn')?.addEventListener('click', () => void login());
    }
}

void init();
