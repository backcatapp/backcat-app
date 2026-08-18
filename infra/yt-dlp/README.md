# YouTube cookie jar (worker)

YouTube blocks datacenter IPs with *"Sign in to confirm you're not a bot"*. A PO
token cannot lift a block that already exists, so an authenticated cookie jar is
the only way the worker downloads audio unattended.

Drop a Netscape-format cookie jar here as `cookies.txt` (gitignored). The worker
mounts this directory and picks the file up automatically — no rebuild, no code
change, no per-episode copying.

## Refresh (a few minutes, when downloads hit the bot wall)

Use a **throwaway Google account**, not your main one — cookie reuse can get an
account flagged.

`--cookies-from-browser` will **not** work. YouTube rotates cookies on any open
YouTube tab; yt-dlp then reports them as no longer valid. Export a frozen
private-window session instead
([yt-dlp wiki](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies)):

1. On a residential-IP machine, install a Netscape exporter (Firefox:
   **cookies.txt**). Skip add-ons named only "Get cookies.txt".
2. Close every YouTube tab in the normal browser.
3. Open a **private/incognito** window. In **one tab**, sign in to YouTube, then
   go to `https://www.youtube.com/robots.txt` in that same tab.
4. Export `youtube.com` cookies from the add-on. Close the private window
   immediately so that session is never opened in a browser again.
5. Copy the file onto the server (bind-mounted; no rebuild):

   ```powershell
   scp -i key.pem cookies.txt ubuntu@<host>:~/backcat-app/infra/yt-dlp/cookies.txt
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
