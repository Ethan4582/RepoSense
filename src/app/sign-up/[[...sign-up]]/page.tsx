import { SignUp } from '@clerk/nextjs';

export const runtime = 'edge';

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignUp
        forceRedirectUrl="/sync-user"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
