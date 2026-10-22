import fs from 'fs';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';

neonConfig.webSocketConstructor = WebSocket;

const envContent = fs.readFileSync('.env', 'utf-8');
let connectionString = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    connectionString = line.split('=')[1].trim().replace(/^["']|["']$/g, '');
  }
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter, log: ['query', 'error', 'warn'] });

async function run() {
  try {
    const project = await prisma.project.create({
      data: {
        name: 'test/repo',
        repoOwner: 'test',
        repoName: 'repo',
        repoUrl: 'https://github.com/test/repo',
        userToProjects: {
          create: {
            userId: 'user_33sXgQIaVosTl8rFK6WRSeHuHHj',
          },
        },
        indexingJobs: {
          create: {
            branch: 'main',
            commitSha: '123456',
            status: 'QUEUED',
          },
        },
      },
    });

    console.log('Created test project:', project.id);

    console.log('Testing findMany:');
    const res = await prisma.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId: 'user_33sXgQIaVosTl8rFK6WRSeHuHHj',
          },
        },
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        indexingJobs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        _count: { select: { wikiPages: true } },
      },
    });
    console.log('SUCCESS findMany, found:', res.length, JSON.stringify(res, null, 2));

    await prisma.indexingJob.deleteMany({ where: { projectId: project.id } });
    await prisma.userToProject.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    console.log('Cleaned up test project.');
  } catch (err) {
    console.error('CAUGHT ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
