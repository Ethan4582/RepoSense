export async function reliableSignOut(
  signOut: (options?: { redirectUrl?: string }) => Promise<unknown>,
) {
  const destination = "/sign-in?logged_out=1";
  try {
    await Promise.race([
      signOut({ redirectUrl: destination }),
      new Promise((resolve) => setTimeout(resolve, 4_000)),
    ]);
  } finally {
    window.location.replace(destination);
  }
}
