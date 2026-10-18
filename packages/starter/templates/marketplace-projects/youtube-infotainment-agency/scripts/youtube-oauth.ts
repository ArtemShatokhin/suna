#!/usr/bin/env bun
/**
 * One-time: mint a YouTube refresh token for the channel account.
 *   1. Google Cloud console → enable "YouTube Data API v3" and "YouTube Analytics API";
 *      create an OAuth client of type "Desktop app".
 *   2. YT_CLIENT_ID=… YT_CLIENT_SECRET=… bun scripts/youtube-oauth.ts
 *   3. Open the printed URL, sign in as the channel, approve, then paste the `code` from the
 *      redirect URL (http://localhost/?code=…) back here.
 *   4. Store the three values as Kortix secrets:
 *      kortix secrets set YT_CLIENT_ID=… YT_CLIENT_SECRET=… YT_REFRESH_TOKEN=…
 */
const id = process.env.YT_CLIENT_ID;
const secret = process.env.YT_CLIENT_SECRET;
if (!id || !secret) throw new Error("set YT_CLIENT_ID and YT_CLIENT_SECRET");
const redirect = "http://localhost";
const scopes = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.search = new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent" }).toString();
console.log(`Open:\n\n${url}\n`);
const code = (prompt("Paste the code parameter from the redirect URL:") ?? "").trim();
const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
});
const body = (await res.json()) as { refresh_token?: string; error?: string };
if (!body.refresh_token) throw new Error(`no refresh token: ${JSON.stringify(body)}`);
console.log(`\nYT_REFRESH_TOKEN=${body.refresh_token}`);
