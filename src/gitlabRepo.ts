interface GitlabNamespace {
	id: number;
	name: string;
	path: string;
	kind: string;
	full_path: string;
	parent_id: number;
	avatar_url: string | null;
	web_url: string;
}

interface GitlabRepository {
	id: number;
	description: string;
	name: string;
	name_with_namespace: string;
	path: string;
	path_with_namespace: string;
	created_at: string;
	default_branch: string;
	tag_list: string[];
	topics: string[];
	ssh_url_to_repo: string;
	http_url_to_repo: string;
	web_url: string;
	readme_url: string | null;
	forks_count: number;
	avatar_url: string | null;
	star_count: number;
	last_activity_at: string;
	namespace?: GitlabNamespace;
}

interface Repo {
	name: string;
	id: number;
	url: string;
	created_at: string;
	updated_at: string;
}

async function fetchGitlabReposPage({
	baseURL,
	page,
	perPage,
	namespace,
}: {
	baseURL: string;
	page: number;
	perPage: number;
	namespace?: string;
}): Promise<Repo[]> {
	console.log(`fetching page ${page} of ${perPage} for namespace ${namespace}`);
	let url = `${baseURL}/api/v4/projects?page=${page}&per_page=${perPage}&statistics=true`;
	if (namespace) {
		url += `&namespace_path=${namespace}`;
	}

	// let us do a get fetch
	const response = await fetch(url);
	const data = (await response.json()) as GitlabRepository[];

	return data.map((repo) => ({
		name: repo.path_with_namespace,
		id: repo.id,
		url: repo.web_url || repo.http_url_to_repo,
		created_at: repo.created_at,
		updated_at: repo.last_activity_at,
	}));
}

export async function getGitlabReposPageCount(request: Request, env: Env, ctx: ExecutionContext) {
	const url = new URL(request.url);
	const baseUrl = url.searchParams.get('url') || 'https://gitlab.com';
	const namespace = url.searchParams.get('namespace') || '';
	const estimate = parseInt(url.searchParams.get('estimate') || '100000'); // estimated number of repos
	let estimatePageCount = Math.ceil(estimate / 100); // estimated number of pages to fetch

	// let's correct the estimate if it's too low
	while (true) {
		const repos = await fetchGitlabReposPage({ baseURL: baseUrl, page: estimatePageCount, perPage: 100, namespace });
		if (repos.length === 100) {
			estimatePageCount *= 2;
			console.log(`estimatePageCount: ${estimatePageCount}`);
		} else {
			break;
		}
	}

	// use binary search to find the page count
	let low = 1;
	let high = estimatePageCount;
	let mid = Math.floor((low + high) / 2);
	let lastFetchNumRepos = 100;

	while (low < high) {
		const repos = await fetchGitlabReposPage({ baseURL: baseUrl, page: mid, perPage: 100, namespace });
		console.log(`repos.length: ${repos.length}, mid: ${mid}, low: ${low}, high: ${high}`);
		lastFetchNumRepos = repos.length;
		if (repos.length === 100) {
			low = mid + 1;
		} else if (repos.length === 0) {
			high = mid - 1;
		} else {
			return {
				total_pages: mid,
				total: (mid - 1) * 100 + lastFetchNumRepos,
			};
		}
		mid = Math.floor((low + high) / 2);
	}
	return {
		total_pages: mid,
		total: (mid - 1) * 100 + lastFetchNumRepos,
	};
}

export async function fetchGitlabReposMany(request: Request, env: Env, ctx: ExecutionContext) {
	const url = new URL(request.url);
	const baseUrl = url.searchParams.get('url') || 'https://gitlab.com';
	const namespace = url.searchParams.get('namespace') || '';
	const startPage = parseInt(url.searchParams.get('start') || '1');
	const numPages = parseInt(url.searchParams.get('limit') || '50');

	const r: Repo[] = [];
	const promises = [];
	for (let page = startPage; page < startPage + numPages; page++) {
		promises.push(fetchGitlabReposPage({ baseURL: baseUrl, page, perPage: 100, namespace }));
	}
	const repos = await Promise.all(promises);
	r.push(...repos.flat());
	return r;
}
