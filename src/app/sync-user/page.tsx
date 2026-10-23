export const runtime = 'edge';
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "~/server/db";

export default async function SyncUserPage() {
  try {
    const authResult = (await auth()) as { userId?: string | null };
    const { userId } = authResult;

    if (!userId) {
      return redirect("/sign-in");
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
    const email = user.emailAddresses[0]?.emailAddress;

    if (email) {
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
          defaultChatProvider: "OPENAI",
          defaultChatModel: "gpt-4o",
          defaultEmbeddingProvider: "OPENAI",
        },
      });
    }

    const projectCount = await db.project.count({
      where: {
        userToProjects: { some: { userId: user.id } },
        deletedAt: null,
      },
    });

    if (projectCount === 0) {
      return redirect("/create");
    }

    return redirect("/dashboard");
  } catch (err) {
    console.error("Sync user error:", err);
    return redirect("/dashboard");
  }
}
