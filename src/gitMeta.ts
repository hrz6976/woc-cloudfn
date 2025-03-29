import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

export async function fetchGitRefs(request: Request, env: Env, ctx: ExecutionContext) {
	const url = new URL(request.url);
	const gitUrls = url.searchParams.getAll('url');
	const AllRefs: Record<string, Record<string, string>> = {};
	const AllErrs: Record<string, string> = {};

	function getByPath(obj: Record<string, any>, path: string | string[]) {
		const parts = Array.isArray(path) ? path : path.split('/');
		if (parts.length === 0) return obj;
		if (obj === undefined) return undefined;
		return getByPath(obj[parts[0]], parts.slice(1));
	}

	if (gitUrls.length === 0) {
		return new Response(JSON.stringify({ error: 'Missing required parameter "url"' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (gitUrls.length > 100) {
		return new Response(JSON.stringify({ error: 'Too many URLs provided. Maximum is 100.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const promises = gitUrls.map(async (gitUrl) => {
		// if the url does not end with .git, add .git
		if (!gitUrl.endsWith('.git')) {
			gitUrl += '.git';
		}
		// if the url does not have a protocol, add https://
		if (!gitUrl.startsWith('http')) {
			gitUrl = 'https://' + gitUrl;
		}

		try {
			const info = await git.getRemoteInfo({
				http,
				url: gitUrl,
			});
			const refs: Record<string, string> = {};
			const headName = info.HEAD;
			if (headName) {
				refs['HEAD'] = getByPath(info, headName) as unknown as string;
			}
			if (info.refs.tags) {
				Object.entries(info.refs.tags as Record<string, string>).forEach(([name, oid]) => {
					// if oid is not a string, do nothing
					if (typeof oid == 'string') {
						if (name.endsWith('^{}')) {
							// override unpeeled tags
							refs[name.slice(0, -3)] = oid;
						} else {
							refs[name] = oid;
						}
					}
				});
			}

			return {
				url: gitUrl,
				refs,
				success: true,
			};
		} catch (error) {
			return {
				url: gitUrl,
				error: error instanceof Error ? error.message : 'An unexpected error occurred',
				success: false,
			};
		}
	});

	// Wait for all promises to resolve
	const results = await Promise.all(promises);

	// Process results
	results.forEach((result) => {
		if (result.success) {
			AllRefs[result.url] = result.refs || [];
		} else {
			AllErrs[result.url] = result.error || 'An unexpected error occurred';
		}
	});

	return {
		data: AllRefs,
		error: AllErrs,
	};
}
