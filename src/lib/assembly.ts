function msToTime(ms: number) {
  const seconds = ms / 1000;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

interface Chapter {
  start: number;
  end: number;
  gist: string;
  headline: string;
  summary: string;
}

interface TranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  chapters?: Chapter[];
  error?: string;
}

export const processMeeting = async (meetingUrl: string) => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return { summaries: [] };
  }

  try {
    const postRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: meetingUrl,
        auto_chapters: true,
      }),
    });

    if (!postRes.ok) {
      return { summaries: [] };
    }

    const initial = (await postRes.json()) as TranscriptResponse;
    const transcriptId = initial.id;

    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: apiKey },
      });
      if (!pollRes.ok) continue;

      const data = (await pollRes.json()) as TranscriptResponse;
      if (data.status === 'completed') {
        const summaries =
          data.chapters?.map((chapter) => ({
            start: msToTime(chapter.start),
            end: msToTime(chapter.end),
            gist: chapter.gist,
            headline: chapter.headline,
            summary: chapter.summary,
          })) ?? [];
        return { summaries };
      }
      if (data.status === 'error') {
        break;
      }
    }

    return { summaries: [] };
  } catch {
    return { summaries: [] };
  }
};
