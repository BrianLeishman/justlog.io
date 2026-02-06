const cognitoDomain = 'https://justlog.auth.us-east-1.amazoncognito.com';
const clientId = '11h4ggbj2m9hehirq0n7hcq5m8';
const scopes = 'openid email profile';

function redirectUri(): string {
    return `${window.location.origin}/auth/callback/`;
}

// PKCE helpers
function generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) {
        binary += String.fromCharCode(b);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function login(): Promise<void> {
    const codeVerifier = generateRandomString(64);
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);

    const challengeBuffer = await sha256(codeVerifier);
    const codeChallenge = base64UrlEncode(challengeBuffer);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: scopes,
        redirect_uri: redirectUri(),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        identity_provider: 'Google',
    });

    window.location.href = `${cognitoDomain}/oauth2/authorize?${params.toString()}`;
}

export async function handleCallback(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
        return false;
    }

    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
    if (!codeVerifier) {
        return false;
    }
    sessionStorage.removeItem('pkce_code_verifier');

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri(),
        code_verifier: codeVerifier,
    });

    const resp = await fetch(`${cognitoDomain}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!resp.ok) {
        return false;
    }

    interface TokenResponse {
        id_token: string;
        access_token: string;
        refresh_token?: string;
    }

    const tokens: TokenResponse = await resp.json() as TokenResponse;
    localStorage.setItem('id_token', tokens.id_token);
    localStorage.setItem('access_token', tokens.access_token);
    if (tokens.refresh_token) {
        localStorage.setItem('refresh_token', tokens.refresh_token);
    }

    // Exchange Cognito token for long-lived API key
    await exchangeForAPIKey(tokens.access_token);

    return true;
}

export function getUser(): { email: string; name: string; picture: string } | null {
    const idToken = localStorage.getItem('id_token');
    if (!idToken) {
        return null;
    }

    try {
        interface IdTokenPayload {
            exp: number;
            email: string;
            name: string;
            picture: string;
        }

        const payload: IdTokenPayload = JSON.parse(atob(idToken.split('.')[1])) as IdTokenPayload;

        if (payload.exp * 1000 < Date.now()) {
            logout();
            return null;
        }

        return {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
        };
    } catch {
        return null;
    }
}

const apiBase = 'https://k24xsd279c.execute-api.us-east-1.amazonaws.com';

async function exchangeForAPIKey(cognitoToken: string): Promise<void> {
    try {
        const resp = await fetch(`${apiBase}/api/token`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cognitoToken}` },
        });
        if (resp.ok) {
            interface TokenResponse {
                api_key: string;
            }
            const data: TokenResponse = await resp.json() as TokenResponse;
            localStorage.setItem('api_key', data.api_key);
        }
    } catch {
        // If exchange fails, we still have the Cognito token as fallback
    }
}

export function getAccessToken(): string | null {
    return localStorage.getItem('api_key') ?? localStorage.getItem('access_token');
}

export function isLoggedIn(): boolean {
    return getUser() !== null;
}

export function logout(): void {
    localStorage.removeItem('id_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('api_key');
}
