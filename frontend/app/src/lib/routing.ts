export type AppRoute = 'player' | 'backoffice';

export function resolveAppRoute(pathname: string): AppRoute {
  return pathname === '/backoffice' || pathname.startsWith('/backoffice/') ? 'backoffice' : 'player';
}
