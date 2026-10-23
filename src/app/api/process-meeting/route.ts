export const runtime = 'edge';
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processMeeting } from "~/lib/assembly";
import { db } from "~/server/db";
import { MeetingStatus } from "@prisma/client";

const bodyParser = z.object({
    meetingUrl: z.string(),
    projectId: z.string(),
    meetingId: z.string()
})
interface MeetingSummary {
    start: string;
    end: string;
    gist: string;
    headline: string;
    summary: string;
}

export const maxDuration = 300



export async function POST(req: NextRequest) {
    const authResult = (await auth()) as { userId?: string | null }
    const { userId } = authResult
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    try {
        const body: unknown = await req.json()
        const { meetingUrl, meetingId } = bodyParser.parse(body)
       
        const result = (await processMeeting(meetingUrl)) as unknown as {
            summaries?: MeetingSummary[];
        };
        const summaries = result.summaries ?? [];
        
        await db.issue.createMany({
            data: summaries.map((summary) => ({
                start: summary.start,
                end: summary.end,
                gist: summary.gist,
                headline: summary.headline,
                summary: summary.summary,
                meetingId
            }))
        });
        
        const updatedMeeting = await db.meeting.update({
            where: { id: meetingId },
            data: {
                status: MeetingStatus.COMPLETED, 
                name: summaries[0]?.headline
            }
        });
    
        return NextResponse.json({ 
            success: true, 
            meeting: updatedMeeting 
        });
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}