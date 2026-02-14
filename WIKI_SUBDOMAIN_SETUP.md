# ChristBase Wiki Subdomain Setup

This guide explains how to access the ChristBase Company Wiki on a `wiki.` subdomain (e.g., `wiki.localhost` or `wiki.christex.com`).

## 1. Local Development (Requires Local Host Setup)

To test the wiki subdomain locally, you need to alias `wiki.localhost` to your own machine.

### Step 1: Edit your Hosts File
You need to add an entry to your `/etc/hosts` file.

1.  Open your terminal.
2.  Run the following command to edit the hosts file (you'll need your password):
    ```bash
    sudo nano /etc/hosts
    ```
3.  Add this line at the bottom of the file:
    ```
    127.0.0.1 wiki.localhost
    ```
4.  Press `Ctrl + O`, `Enter` to save, and `Ctrl + X` to exit.

### Step 2: Access the Wiki
1.  Make sure your dev server is running (`npm run dev`).
2.  Open your browser and navigate to:
    **http://wiki.localhost:3000**

You should see the read-only version of the company wiki.

---

## 2. Production Deployment (Vercel Example)

To deploy this to production, you need to configure your domain provider and hosting platform.

### Step 1: Add the Subdomain in Vercel
1.  Go to your Vercel Dashboard -> Project Settings -> **Domains**.
2.  Add `wiki.yourdomain.com` (e.g., `wiki.christex.com`).
3.  Vercel will provide DNS records (usually a CNAME or A record) for you to add.

### Step 2: Configure DNS
1.  Log in to your domain registrar (e.g., Godaddy, Namecheap, Cloudflare).
2.  Add the DNS record provided by Vercel.
    - **Type**: CNAME
    - **Name**: `wiki`
    - **Value**: `cname.vercel-dns.com` (or whatever Vercel provides).

### Step 3: Verify
Once DNS propagates, navigating to `https://wiki.yourdomain.com` will serve the wiki pages via the `published-wiki` routes, thanks to the middleware routing.

## Troubleshooting

- **Organization Not Found**: The current setup hardcodes looking for the organization with slug `christex`. Ensure your database has an organization with this slug.
- **Empty Wiki**: If you see "No published pages", ensure you have created wiki pages in the main dashboard under the "Company" namespace.

