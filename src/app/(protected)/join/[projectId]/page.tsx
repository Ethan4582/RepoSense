import React from 'react'
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { db } from '~/server/db'
import { redirect } from 'next/navigation'


type Props = {
    params: Promise<{ projectId: string }>
}

const JoinHandler = async (props: Props) => {
    const { projectId } = await props.params
    const { userId } = await auth()
    if (!userId) return redirect("/sign-in")
    const dbUser = await db.user.findUnique({
        where: {
            id: userId
        }
    })
    const user = await clerkClient.users.getUser(userId)

    // Check if a user with this email already exists
    const existingEmailUser = await db.user.findUnique({
      where: { emailAddress: user.emailAddresses?.[0]?.emailAddress }
    });

    if (!dbUser && !existingEmailUser) {
      await db.user.create({
        data: {
          id: userId,
          emailAddress: user.emailAddresses?.[0]?.emailAddress,
          imageUrl: user.imageUrl,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      });
    }
   const project = await db.project.findUnique({
    where: {
        id: projectId
    }
})
if (!project) return redirect("/dashboard")
try {
    await db.userToProject.create({
        data: {
            userId,
            projectId
        }
    })
} catch (error) {
    console.log('user already in project')
}

return redirect(`/dashboard/${projectId}/`)
}

export default JoinHandler