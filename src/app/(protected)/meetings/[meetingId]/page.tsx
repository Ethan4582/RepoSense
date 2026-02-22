

import React from 'react'
import IssuesList from './issue-list'


type Props = {
    params: Promise<{ meetingId: string }>
}

const MeetingDetailsPage = async ({ params }: Props) => {
    const { meetingId } = await params
    return (
        <IssuesList meetingId={meetingId} />
    )
}

export default MeetingDetailsPage