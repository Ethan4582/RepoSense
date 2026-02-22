
'use client '

import React from 'react'
import useProject from '~/hooks/use-project'
import { api } from '~/trpc/react'

const TeamMembers = () => {
    const { projectId } = useProject()
    const { data: members } = api.project.getTeamMembers.useQuery({ projectId })
    return (
        <div className="flex items-center gap-2">
            {members?.map(member => (
                <img 
                    key={member.id} 
                    height={30}
                    width={30}
                    src={member.user.imageUrl ||  "/img1.png"} 
                    alt={member.user.firstName || ''} 
                    className="w-8 h-8 rounded-full" 
                />
            ))}
        </div>
    )
}

export default TeamMembers