import { auth, clerkClient } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
// import { PrismaClient } from "@prisma/client";
import { db } from "~/server/db";
// export const db = new PrismaClient();

export default async function SyncUserPage() {
 
  const authResult = (await auth()) as { userId?: string | null };
  const { userId } = authResult;

  
  if (!userId) {
    throw new Error("User is not found");
  }

  const client = (await clerkClient()) as unknown as {
    users: {
      getUser: (id: string) => Promise<{
        id: string;
        emailAddresses: Array<{ emailAddress?: string | null }>;
        imageUrl: string;
        firstName: string | null;
        lastName: string | null;
      }>;
    };
  };
  const user = await client.users.getUser(userId);

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
        defaultChatProvider: "OPENAI",
        defaultChatModel: "gpt-4o",
        defaultEmbeddingProvider: "OPENAI",
      },
    });

  return redirect("/dashboard");
}