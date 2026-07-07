-- Shareable invite links have no recipient email, so email becomes optional.
ALTER TABLE "OrganizationInvitation" ALTER COLUMN "email" DROP NOT NULL;
