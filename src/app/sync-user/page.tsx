import { auth, clerkClient } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
// import { PrismaClient } from "@prisma/client";
import { db } from "~/server/db";
// export const db = new PrismaClient();

export default async function SyncUserPage() {
 
  const { userId } = await auth();

  
  if (!userId) {
    throw new Error("User is not found");
  }

  const client = await clerkClient();
  const  user = await client.users.getUser(userId);

  if (!user.emailAddresses[0]?.emailAddress) {
    return notFound();
  }

  await db.user.upsert({
      where: {
        emailAddress: user.emailAddresses[0]?.emailAddress ?? "",
      },
      update: {
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      create: {
        id: user.id,
        emailAddress: user.emailAddresses[0]?.emailAddress ?? "",
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

  return redirect("/dashboard");
}