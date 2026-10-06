# Skuzi social posting robot

- `queue.json`: the plan. One entry per post: `id`, `audience` (guest / waiter / owner), `at` (UTC), `video` (path on the website) and `caption`.
- `../client/public/social/*.mp4`: the videos, served at https://tabpro.lol/social/… so Buffer can download them.
- `post.mjs`: sends the next 3 days of posts to Buffer (free plan: max 10 queued per channel). Buffer publishes them on Instagram as Reels.
- `sent.json`: what was already sent to Buffer (the robot's memory; committed back after each run).
- Runs every day at 07:00 Kigali, whenever `queue.json` or the videos change, or by hand (Actions → Social posts → Run workflow).
- Needs the `BUFFER_API_KEY` repository secret. Video sources live in ~/Documents/TabPro Business/_Design sources/social.
- To change a post that hasn't gone out: edit its caption or time in `queue.json` and push; the robot replaces it in Buffer. Remove an entry to cancel it.
