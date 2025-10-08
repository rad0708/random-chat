import type { NextApiRequest, NextApiResponse } from 'next';
import { csrf } from 'csrf-lite';

const csrfProtection = csrf({
  secret: process.env.CSRF_SECRET ?? 'shufflechat-secret',
  cookie: {
    key: 'shufflechat.csrf',
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
});

type CsrfRequest = NextApiRequest & { csrfToken: () => string };

function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise<void>((resolve, reject) => {
    fn(req, res, (result: unknown) => {
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve();
      }
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: '허용되지 않는 요청입니다.' });
    return;
  }

  try {
    await runMiddleware(req, res, csrfProtection);
    const token = (req as CsrfRequest).csrfToken?.();
    res.status(200).json({ csrfToken: token });
  } catch (error) {
    console.error('CSRF 토큰 발급 실패', error);
    res.status(500).json({ message: '토큰 발급 중 오류가 발생했습니다.' });
  }
}
