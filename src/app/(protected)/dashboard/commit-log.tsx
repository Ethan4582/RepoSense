'use client'

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import useProject from '~/hooks/use-project';
import { cn } from '~/lib/utils';

import { motion, AnimatePresence } from 'framer-motion';
import { api } from '~/trpc/react';

const CommitLog = () => {
  const { projectId, project } = useProject();
  const { data: commits } = api.project.getCommits.useQuery({
    projectId: projectId!,
  });

  return (
    <div className="container mx-auto p-4">
      <AnimatePresence>
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-6"
        >
          {commits?.map((commit, commitIdx) => (
            <motion.li
              key={commit.id}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              transition={{ duration: 0.5, delay: commitIdx * 0.1 }}
              className="relative flex gap-x-4"
            >
              <div
                className={cn(
                  commitIdx === commits.length - 1 ? 'h-6' : 'h-12',
                  'absolute left-0 top-0 flex w-6 justify-center'
                )}
              >
                <div className="w-px bg-gray-200" />
              </div>
              <motion.img
                src={commit.commitAuthorAvatar}
                alt="commit author avatar"
                className="relative mt-3 size-10 flex-none rounded-full bg-gray-50 ring-2 ring-white shadow-md"
                whileHover={{ scale: 1.1, rotate: 360 }}
                transition={{ duration: 0.3 }}
              />
              <motion.div
                className="flex-auto rounded-lg bg-white p-4 ring-1 ring-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex justify-between gap-x-4">
                  <Link
                    target="_blank"
                    href={`${project?.repoUrl}/commit/${commit.commitHash}`}
                    className="py-1 text-sm leading-5 text-gray-500 hover:text-gray-900 hover:underline transition-colors duration-200"
                  >
                    <span className="font-medium text-gray-900">
                      {commit.commitAuthorName}
                    </span>{' '}
                    <span className="inline-flex items-center gap-1">
                      Committed
                      <ExternalLink className="size-4 text-gray-500 hover:text-twitter-blue transition-colors duration-200" />
                    </span>
                  </Link>
                </div>
                <motion.span
                  className="block mt-2 font-semibold text-gray-900 text-lg"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                > 
                  {commit.commitMessage}
                </motion.span>
                <motion.pre
                  className="mt-2 whitespace-pre-wrap leading-6 text-sm text-gray-500"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {commit.summary}
                </motion.pre>
              </motion.div>
            </motion.li>
          ))}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
};

export default CommitLog;