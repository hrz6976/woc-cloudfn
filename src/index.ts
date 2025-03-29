import { AutoRouter, cors, json } from 'itty-router';
import { fetchGitRefs } from './gitMeta';
import { getGitlabReposPageCount, fetchGitlabReposMany } from './gitlabRepo';

const { preflight, corsify } = cors();
const router = AutoRouter({
	before: [preflight], // <-- put preflight upstream
	finally: [corsify], // <-- put corsify downstream
});

router.get('/git/refs', fetchGitRefs);
router.get('/gitlab/repos', fetchGitlabReposMany);
router.get('/gitlab/repos/count', getGitlabReposPageCount);

router.all(
	'*',
	() =>
		new Response(
			JSON.stringify({
				error: 'Not Found',
				apis: router.routes.map((route) => ({
					method: route[0],
					path: route[3],
				})),
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			}
		)
);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return router
			.fetch(request)
			.then(json)
			.catch((err) => {
				console.error(err);
				return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			});
	},
} satisfies ExportedHandler<Env>;
