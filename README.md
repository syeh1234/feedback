# AP Statistics Classroom Peer Review

## Run locally

1. Open a terminal in this folder.
2. Start the classroom server:

   ```sh
   npm start
   ```

3. Open `http://localhost:3000` in a browser. Do not open `index.html` directly; classrooms need the server.

The server uses only Node.js built-ins. It stores shared classroom data in `classroom-data.json` and mirrors submissions to `peer-review-submissions.csv` in this folder. Those files are not served to browsers. Keep them backed up with the project folder.

## Join and review

- Students enter the same classroom ID, then select **Join classroom**. The first student creates the room. The server automatically assigns each joining student a unique numeric session ID and displays it read-only.
- Each browser gets a private access token paired with its assigned session ID. Returning to the same session requires the same browser session storage.
- Students can submit once per session ID. IDs are unique within each classroom.
- When at least two students have submitted, any joined participant can close the classroom.
- Closing redirects every participant to `peer-review.html`, which currently repeats the worksheet through the Claim section; content after Claim is intentionally blank for the next development step.
- Closing creates a shuffled assignment cycle: each submitter gets another submitter, nobody gets their own work, and every submission is assigned once.
- Students only receive their own assignment. The full CSV remains on the server computer.

## Different computers

For students on the same Wi-Fi, start the server on the host computer and have classmates open `http://<host-computer-LAN-IP>:3000`. The server listens on all network interfaces. Allow Node through the computer's firewall only on trusted/private networks.

For students joining from different networks, deploy this server on a host reachable by everyone and use HTTPS. Keep one server instance with persistent disk, or replace the JSON file store with a managed database before scaling beyond a small class. Do not run multiple server instances against the same JSON files.

This starter server has no teacher role or room password. Anyone with the classroom ID can join while the room is open, and any participant can close it. The first creator does not receive special privileges. Session IDs are visible identifiers, not passwords; each browser also receives an access token, and returning students need the same browser session to reclaim it. Use HTTPS on any untrusted network.

## Test

```sh
npm test
```
