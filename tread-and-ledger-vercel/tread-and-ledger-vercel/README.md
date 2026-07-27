# Tread & Ledger — deployment guide

A daily takings + P&L tracker for the shop. Runs on Vercel (free) with a free
Postgres database. Once deployed, anyone with the web address can use it —
no login required, so keep the address to your staff.

**Heads up:** Vercel's free "Hobby" plan is intended for non-commercial use.
It works fine technically for an internal shop tool, but if you want to be
fully compliant with their terms for business use, you'd move to the Pro
plan (~$20/month) later. No need to worry about this to get started.

---

## Step 1 — Put the code on GitHub

1. Go to https://github.com and create a free account if you don't have one.
2. Click the **+** icon (top right) → **New repository**.
3. Name it `tread-and-ledger`, keep it **Private**, click **Create repository**.
4. On the next page, click **uploading an existing file**.
5. Unzip the file I gave you, then drag the *contents* of the folder
   (not the folder itself) into the GitHub upload box.
6. Scroll down, click **Commit changes**.

## Step 2 — Create the Vercel project

1. Go to https://vercel.com and sign up free (use "Continue with GitHub" —
   it's the easiest option, and it links your account automatically).
2. Click **Add New...** → **Project**.
3. Find `tread-and-ledger` in the list and click **Import**.
4. Leave all settings as default and click **Deploy**.
5. Wait a minute — it'll fail or half-work at this point, that's expected,
   because there's no database connected yet. Continue to Step 3.

## Step 3 — Add the free database

1. In your new Vercel project, click the **Storage** tab.
2. Click **Create Database** → choose **Postgres** (powered by Neon) →
   pick the free plan.
3. Click **Connect** to link it to your `tread-and-ledger` project.
   This automatically adds the database connection details your app needs.
4. Go to the **Deployments** tab, click the three dots on the latest
   deployment, and choose **Redeploy** (so it picks up the new database
   connection).

## Step 4 — Set up the database tables

1. Once redeployed, click **Visit** to open your app — note the address,
   it'll look like `tread-and-ledger-yourname.vercel.app`.
2. In your browser, go to that address followed by `/api/init`, e.g.
   `https://tread-and-ledger-yourname.vercel.app/api/init`
3. You should see a message saying the database is ready. You only need
   to do this once, ever.

## Step 5 — Start using it

Go to your app's main address (without `/api/init`) — that's the one to
share with your staff. Bookmark it on the shop computer/tablet, or save it
to the home screen on phones for one-tap access.

---

## Making changes later

If you ever want to tweak the design or add a feature, come back to me with
the GitHub repo, I can edit the code, and you just upload the changed files
to GitHub the same way — Vercel redeploys automatically within a minute or
two of any change.

## If something goes wrong

- **Blank page or error on load**: double check Step 3 — the database
  needs to be connected and the project redeployed after connecting it.
- **"Couldn't load data" banner in the app**: visit `/api/init` again, it's
  safe to run more than once.
- Feel free to send me a screenshot of any error and I'll help you debug it.
