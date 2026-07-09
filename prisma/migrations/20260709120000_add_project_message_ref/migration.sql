-- Add PROJECT to the message reference type so chat can tag projects (`+project`).
ALTER TYPE "MessageRefType" ADD VALUE IF NOT EXISTS 'PROJECT';
