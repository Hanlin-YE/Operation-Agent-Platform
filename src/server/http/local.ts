// Local configuration endpoints accept same-origin browser requests only.
export function requireLocalMutation(request: Request) {
 const origin = request.headers.get('origin');
 if (origin && new URL(origin).host !== (request.headers.get('host') || new URL(request.url).host)) throw new Error('请求来源与本地应用不一致');
 if (request.headers.get('sec-fetch-site') === 'cross-site') throw new Error('请求来源与本地应用不一致');
}
