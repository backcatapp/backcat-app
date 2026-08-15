# YouTube cookie jar (worker)

YouTube blocks datacenter IPs with *"Sign in to confirm you're not a bot"*. A PO
token cannot lift a block that already exists, so an authenticated cookie jar is
the only way the worker downloads audio unattended.

Drop a Netscape-format cookie jar here as `cookies.txt` (gitignored). The worker
mounts this directory and picks the file up automatically — no rebuild, no code
change, no per-episode copying.

## Refresh (a few minutes, roughly monthly)

Use a **throwaway Google account**, not your main one — cookie reuse can get an
account flagged.

1. On a machine with a residential IP, open an **incognito** window and sign in
   to YouTube.
2. Export cookies for `youtube.com` in Netscape format (any "cookies.txt"
   browser extension), or:

   ```powershell
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXQ"
   ```

3. Close the incognito window **without signing out** — signing out invalidates
   the session you just exported.
4. Copy it to the server and restart the worker:

   ```bash
   scp -i key.pem cookies.txt ubuntu@<host>:~/backcat-app/infra/yt-dlp/cookies.txt
   docker compose restart worker
   ```

Then hit **Retry** on the failed `download` jobs — later stages run on their own.

## Verify

```bash
docker compose exec worker yt-dlp --cookies yt-dlp/cookies.txt \
  --extractor-args "youtube:player_client=web,mweb,android" \
  --simulate "https://www.youtube.com/watch?v=<id>"
```

## If cookies aren't enough

Some AWS ranges are blocked hard enough that even authenticated requests fail.
Set `YT_DLP_PROXY` in the repo-root `.env` to a residential proxy and restart the
worker — the download stage routes through it.
