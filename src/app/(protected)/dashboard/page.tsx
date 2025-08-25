"use client";

import { ExternalLink, GithubIcon } from "lucide-react";
import Link from "next/link";
import useProject from "~/hooks/use-project";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question-card";
import ArchiveButton from "./archive-buttom";
import MeetingCard from "./meeting-card";


export default function DashboardPage() {
   const {project} = useProject();
     return (
   <div>
     <div className="flex  items-center justify-between flex-wrap gap-4">
      <div className="w-fit rounded-md bg-primary px-4 py-3">
        <div className="flex items-center">
           <GithubIcon className="size-5 text-white" />
        <div className="ml-2">

          <p className="text-sm font-medium text-white">
            This project is linked to {}
            <Link
              href={project?.repoUrl ?? " "}
              className="inline-flex items-center gap-1 text-sm font-medium text-white hover:underline"
            >
              {project?.repoUrl}
               <ExternalLink className="ml-1 size-4">
            </ExternalLink>
            </Link>
          </p>
        </div>
        </div>
      </div>

      <div className="h-4"></div>
      <div className="flex items-center gap-4">
        Team Members
        invite buttom 
        <ArchiveButton />
        <MeetingCard />
      </div>

    </div>

   <div className="grid grid-cols-1 gap-4 sm:grid-cols-9">
  <div className="sm:col-span-5"> 
    <AskQuestionCard />
  </div>
</div>

    <div className="mt-8"></div>

    <CommitLog />
   </div>
  );
}   



