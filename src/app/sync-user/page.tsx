import { auth, clerkClient } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "~/server/db";

export default async function SyncUserPage() {
  console.log("Sync user page reached");

  const { userId } = await auth();
  if (!userId) {
    throw new Error("User is not found");
  }

  const client = await clerkClient();
  let user;
  try {
    user = await client.users.getUser(userId);
  } catch (error) {
    throw new Error("Failed to fetch user from Clerk");
  }

  if (!user.emailAddresses || user.emailAddresses.length === 0) {
    return notFound();
  }

  const email = user.emailAddresses[0]?.emailAddress || "";

  try {
    await db.user.upsert({
      where: {
        emailAddress: email,
      },
      update: {
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      create: {
        id: user.id,
        emailAddress: email,
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
    console.log("User synced successfully:", email);
  } catch (error) {
    console.error("Database sync error:", error);
    throw new Error(
      `Failed to sync user with database: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  redirect("/dashboard");
}