/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

type Ref = {
	ref: string;
	oid: string;
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const gitUrls = url.searchParams.getAll('url');
		const prefix = url.searchParams.get('prefix') || 'refs/tags/';
		const AllRefs: Record<string, Ref[]> = {};
		const AllErrs: Record<string, string> = {};
		if (gitUrls.length === 0) {
			return new Response(JSON.stringify({ error: 'Missing required parameter "url"' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		if (gitUrls.length >= 10) {
			return new Response(JSON.stringify({ error: 'Too many URLs provided. Maximum is 10.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		for (const gitUrl of gitUrls) {
			try {
				if (!gitUrl || !prefix) {
					return new Response(
						JSON.stringify({
							error: 'Missing required parameters. Both "url" and "prefix" are required.',
						}),
						{
							status: 500,
							headers: { 'Content-Type': 'application/json' },
						}
					);
				}
				const refs = await git.listServerRefs({
					http,
					url: gitUrl,
					prefix: prefix,
					peelTags: true,
				});
				AllRefs[gitUrl] = refs;
			} catch (error) {
				if (error instanceof Error) {
					AllErrs[gitUrl] = error.message;
				} else {
					AllErrs[gitUrl] = 'An unexpected error occurred';
				}
			}
		}
		return new Response(JSON.stringify({ data: AllRefs, errors: AllErrs }), {
			headers: { 'Content-Type': 'application/json' },
		});
	},
} satisfies ExportedHandler<Env>;
