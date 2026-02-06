import { getAccessToken } from './auth';

const apiBase = 'https://k24xsd279c.execute-api.us-east-1.amazonaws.com';

interface Entry {
    UID: string;
    SK: string;
    Type: string;
    Description: string;
    Calories: number;
    Protein: number;
    Carbs: number;
    Fat: number;
    Fiber: number;
    Duration: number;
    Value: number;
    Unit: string;
    Notes: string;
    CreatedAt: string;
}

export type { Entry };

export async function getEntries(type: string, from?: string, to?: string): Promise<Entry[]> {
    const token = getAccessToken();
    if (!token) {
        return [];
    }

    const params = new URLSearchParams({ type });
    if (from) {
        params.set('from', from);
    }
    if (to) {
        params.set('to', to);
    }

    const resp = await fetch(`${apiBase}/api/entries?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!resp.ok) {
        return [];
    }

    const data: Entry[] = await resp.json() as Entry[];
    return data ?? [];
}
