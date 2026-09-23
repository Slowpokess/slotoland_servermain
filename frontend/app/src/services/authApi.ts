import type { ApiRequester } from '@/lib/api';
import type { AuthResponse, PropResponse, UserItem, UserListResponse, WalletResponse } from '@/lib/types';

export interface AccountSnapshot {
  user: UserItem;
  wallet: number;
  access: string | number;
  accessFlags: string | number;
  mrtp: string | number;
}

export function refreshSession(request: ApiRequester): Promise<AuthResponse> {
  return request<AuthResponse>('/refresh', {
    method: 'GET',
    tokenType: 'refresh',
  });
}

export function signInAccount(request: ApiRequester, email: string, secret: string): Promise<AuthResponse> {
  return request<AuthResponse>('/signin', {
    method: 'POST',
    auth: false,
    body: { email, secret },
  });
}

export function signUpAccount(
  request: ApiRequester,
  email: string,
  secret: string,
  name: string,
): Promise<{ email?: string }> {
  return request<{ email?: string }>('/signup', {
    method: 'POST',
    auth: false,
    body: { email, secret, name },
  });
}

export function changeAccountSecret(
  request: ApiRequester,
  uid: number,
  oldsecret: string,
  newsecret: string,
): Promise<unknown> {
  return request('/user/secret', {
    method: 'POST',
    body: { uid, oldsecret, newsecret },
  });
}

export async function loadAccountSnapshot(
  request: ApiRequester,
  uid: number,
  cid: number,
): Promise<AccountSnapshot> {
  const [userInfo, propInfo, walletInfo, accessInfo] = await Promise.all([
    request<UserListResponse>('/user/is', {
      method: 'POST',
      body: { list: [{ uid }] },
    }),
    request<PropResponse>('/prop/get', {
      method: 'POST',
      body: { cid, uid },
    }),
    request<WalletResponse>('/prop/wallet/get', {
      method: 'POST',
      body: { cid, uid },
    }),
    request<{ access?: string | number }>('/prop/al/get', {
      method: 'POST',
      body: { cid, uid, all: true },
    }),
  ]);

  return {
    user: userInfo.list?.[0] || {},
    wallet: Number(walletInfo.wallet ?? propInfo.wallet ?? 0),
    access: propInfo.access ?? '-',
    accessFlags: accessInfo.access ?? propInfo.access ?? '-',
    mrtp: propInfo.mrtp ?? '-',
  };
}
