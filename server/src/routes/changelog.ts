import { Lux } from '@luxdb/sdk';

interface GitHubCommit {
    sha: string;
    commit: {
        author: { name: string; date: string };
        message: string;
    };
    html_url: string;
}

interface GitHubPR {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    state: string;
    merged_at: string | null;
    updated_at: string;
    created_at: string;
    base: { repo: { full_name: string } };
}

interface GitHubRepo {
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    updated_at: string;
}

interface ChangelogEntry {
    hash: string;
    author: string;
    date: string;
    message: string;
    url: string;
    repo: string;
    type: 'commit' | 'pr';
    prState?: 'open' | 'merged' | 'closed';
}

const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const GH_USER = process.env.GITHUB_USER || '';
const CACHE_TTL = 5 * 60 * 1000;
const PREFS_KEY = 'changelog:selected-repos';

let commitCache: Map<string, { entries: ChangelogEntry[]; at: number }> = new Map();
let prCache: Map<string, { entries: ChangelogEntry[]; at: number }> = new Map();
let repoCache: GitHubRepo[] = [];
let repoCacheAt = 0;

function ghHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
    if (GH_TOKEN) h['Authorization'] = `Bearer ${GH_TOKEN}`;
    return h;
}

const GH_ORGS = (process.env.GITHUB_ORGS || '').split(',').map(s => s.trim()).filter(Boolean);

async function fetchAllRepos(): Promise<GitHubRepo[]> {
    const now = Date.now();
    if (repoCache.length > 0 && now - repoCacheAt < 10 * 60 * 1000) return repoCache;

    if (!GH_TOKEN) return [];

    const urls = [
        'https://api.github.com/user/repos?per_page=100&sort=updated&type=owner',
        ...GH_ORGS.map(org => `https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated`),
    ];

    try {
        const results = await Promise.all(urls.map(async url => {
            const res = await fetch(url, { headers: ghHeaders(), signal: AbortSignal.timeout(10000) });
            if (!res.ok) return [];
            return await res.json() as GitHubRepo[];
        }));
        const seen = new Set<string>();
        const all: GitHubRepo[] = [];
        for (const repos of results) {
            for (const r of repos) {
                if (!seen.has(r.full_name)) {
                    seen.add(r.full_name);
                    all.push(r);
                }
            }
        }
        all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        repoCache = all;
        repoCacheAt = now;
        return repoCache;
    } catch {
        return repoCache;
    }
}

async function fetchRepoCommits(repo: string): Promise<ChangelogEntry[]> {
    const now = Date.now();
    const cached = commitCache.get(repo);
    if (cached && now - cached.at < CACHE_TTL) return cached.entries;

    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=50`, {
            headers: ghHeaders(),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return cached?.entries ?? [];
        const data = await res.json() as GitHubCommit[];
        const entries: ChangelogEntry[] = data.map(c => ({
            hash: c.sha.slice(0, 7),
            author: c.commit.author.name,
            date: c.commit.author.date,
            message: c.commit.message.split('\n')[0],
            url: c.html_url,
            repo: repo.split('/')[1] || repo,
            type: 'commit',
        }));
        commitCache.set(repo, { entries, at: now });
        return entries;
    } catch {
        return cached?.entries ?? [];
    }
}

async function fetchRepoPRs(repo: string): Promise<ChangelogEntry[]> {
    const now = Date.now();
    const cached = prCache.get(repo);
    if (cached && now - cached.at < CACHE_TTL) return cached.entries;

    try {
        const allPRs: GitHubPR[] = [];
        let page = 1;
        while (page <= 5) {
            const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`, {
                headers: ghHeaders(),
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) break;
            const batch = await res.json() as GitHubPR[];
            allPRs.push(...batch);
            if (batch.length < 100) break;
            page++;
        }
        const data = allPRs;
        const entries: ChangelogEntry[] = data.map(pr => ({
            hash: `#${pr.number}`,
            author: pr.user.login,
            date: pr.merged_at || pr.updated_at,
            message: pr.title,
            url: pr.html_url,
            repo: repo.split('/')[1] || repo,
            type: 'pr',
            prState: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
        }));
        prCache.set(repo, { entries, at: now });
        return entries;
    } catch {
        return cached?.entries ?? [];
    }
}

export async function handleChangelog(req: Request, path: string, lux: Lux): Promise<Response | null> {
    if (req.method === 'GET' && path === '/changelog/repos') {
        const repos = await fetchAllRepos();
        return Response.json(repos.map(r => ({
            name: r.name,
            full_name: r.full_name,
            description: r.description,
            private: r.private,
            updated_at: r.updated_at,
        })));
    }

    if (req.method === 'GET' && path === '/changelog/prefs') {
        try {
            const raw = await lux.get(PREFS_KEY);
            const repos = raw ? JSON.parse(raw) : [];
            return Response.json({ repos });
        } catch {
            return Response.json({ repos: [] });
        }
    }

    if (req.method === 'POST' && path === '/changelog/prefs') {
        try {
            const body = await req.json() as { repos?: string[] };
            const repos = body.repos ?? [];
            await lux.set(PREFS_KEY, JSON.stringify(repos));
            return Response.json({ ok: true, repos });
        } catch {
            return Response.json({ error: 'invalid body' }, { status: 400 });
        }
    }

    if (req.method === 'POST' && path === '/changelog') {
        try {
            const body = await req.json() as { repos?: string[] };
            const repos = body.repos ?? [];
            if (repos.length === 0) return Response.json({ commits: [] });

            const [commitResults, prResults] = await Promise.all([
                Promise.all(repos.map(fetchRepoCommits)),
                Promise.all(repos.map(fetchRepoPRs)),
            ]);
            const all = [...commitResults.flat(), ...prResults.flat()];
            all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return Response.json({ commits: all.slice(0, 200) });
        } catch {
            return Response.json({ commits: [] });
        }
    }

    return null;
}
