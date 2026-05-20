# Website root for flavors99789catalog.com

This folder contains a minimal static website root suitable for previewing in the Codespace.

Files:

- `index.html` — landing page
- `styles.css` — minimal styles
- `start.sh` — script to run a local server (uses Python 3)

Quick preview

```bash
# make start.sh executable and run
chmod +x website_root/start.sh
./website_root/start.sh 8000
# then open http://localhost:8000 in the Codespace browser or port-forward
```

You can replace the contents with your real site files and deploy to your hosting provider.

Deploying via GitHub Pages

1. Commit and push the files to the `main` branch. The included GitHub Actions workflow will publish the contents of `website_root` to GitHub Pages automatically.

```bash
git add website_root .github
git commit -m "Add static site and GitHub Pages workflow"
git push origin main
```

2. The workflow publishes the site and includes a `CNAME` for the custom domain `flavors99789catalog.com`.

DNS / custom domain

- Add a DNS `A` record pointing to GitHub Pages IPs or a `CNAME` record pointing to `<your-github-username>.github.io` for the root and/or `www` as appropriate.
- After the workflow completes, verify the Pages settings in the repository and that the custom domain is shown.

Server for automated crypto confirmations

The repo now includes a Node/Express server in `server/` which uses Coinbase Commerce to create hosted charges and a webhook endpoint to receive payment confirmations.

Steps to enable automated confirmations:

1. Deploy the `server/` app to a public host (Heroku, Fly, Render, Railway, or your own VPS). Set environment variables in the host:

```
COINBASE_COMMERCE_API_KEY=...
COINBASE_COMMERCE_WEBHOOK_SHARED_SECRET=...
PORT=4000
```

2. In Coinbase Commerce, configure a webhook pointing to `https://your-server.example.com/api/webhook` and copy the shared secret into the server env var.

3. In `website_root/js/config.js` set `backendUrl` to the deployed server origin (e.g. `https://your-server.example.com`). The checkout UI will create hosted charges and poll the server for confirmation.

Limitations and security

- You must provide the Coinbase Commerce API key and webhook secret; secrets must not be committed to the repo.
- Webhook verification is implemented using HMAC signature checking; keep the shared secret private.
- This implementation uses a simple file-based `orders.json`. For production, use a proper database.

Notes

- I couldn't start a local server from this assistant environment (execution blocked). To preview locally, run the provided `start.sh` in the Codespace terminal:

```bash
chmod +x website_root/start.sh
./website_root/start.sh 8000
```

- The current site is a placeholder. Replace `index.html` with your real site files before publishing the live domain.

Deploying to Vercel with automated crypto confirmations (recommended)

This repo is preconfigured for Vercel. The static site is served from `website_root/` and serverless API endpoints are under `api/`.

High-level steps:

1. Create a Supabase project (or another database) to store orders.
	- In Supabase, create a table `orders` with columns:
	  - `order_id` (text, primary key)
	  - `charge_id` (text)
	  - `status` (text)
	  - `total` (numeric or text)
	  - `inserted_at` (timestamp, default now())

2. In Vercel, import this repository as a new Project.
	- Vercel will detect `vercel.json` and deploy the static site and serverless API.

3. Add the following Environment Variables in the Vercel project settings:

```
COINBASE_COMMERCE_API_KEY=<your-coinbase-commerce-api-key>
COINBASE_COMMERCE_WEBHOOK_SHARED_SECRET=<your-webhook-shared-secret>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

4. Configure the Coinbase Commerce webhook URL to point to:

```
https://<your-vercel-project-domain>/api/webhook
```

5. Add your custom domain in the Vercel project settings (`flavors99789catalog.com`) and follow Vercel's DNS instructions. Typically Vercel provides a CNAME target (eg. `cname.vercel-dns.com`) to add at your registrar.

6. Set `website_root/js/config.js` `backendUrl` to your Vercel project origin (for example `https://your-project.vercel.app`) or leave blank to use relative `/api` paths.

7. After deployment, the checkout's "Create hosted crypto charge" button will create a Coinbase Commerce hosted payment, and the webhook will update order status in Supabase so the frontend can detect confirmations.

Security reminders

- Keep API keys and secrets in Vercel environment variables, not in the repo.
- Use the Supabase service role key only on server-side (Vercel env). Do NOT expose it in client-side code.
