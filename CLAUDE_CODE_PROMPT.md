Paste everything below the line into Claude Code, with this folder open.
-----------------------------------------------------------------------

I'm not a coder. This folder contains a finished, tested app (read CLAUDE.md and README.md first). Your job is to verify it, push it to GitHub, and deploy it to Vercel. Explain each step to me in plain language, and do everything you can yourself.

1. Check the tools: make sure Node.js 20+, git, the GitHub CLI (gh), and the Vercel CLI are installed. Install any that are missing (use npm i -g vercel for Vercel).
2. Verify the code: run npm install and node --check on every .js file in api/ and lib/. Fix only genuine errors, and don't redesign anything.
3. Also copy skills/meera-voice/SKILL.md and skills/triage-rubric/SKILL.md into .claude/skills/<same folder name>/SKILL.md so you can use them too. Keep the originals in skills/, because the app reads them.
4. GitHub: run gh auth login (I'll finish the login in my browser), then git init, commit everything, and run gh repo create skinstinct-content-engine --private --source=. --push. Make sure .env files and node_modules are NOT committed.
5. Vercel: run vercel login (I'll confirm in my browser), then vercel link to create a project, and connect it to the GitHub repo if the CLI offers to.
6. Environment variables: add these to Vercel production with vercel env add NAME production. Ask me to paste each value into the terminal myself when prompted. Don't write the values into any file.
   - TELEGRAM_BOT_TOKEN
   - GEMINI_API_KEY
   - WEBHOOK_SECRET (tell me to invent a long word with no spaces)
   - LINKEDIN_ACCESS_TOKEN (optional, skip if I don't have it yet)
7. Deploy: run vercel --prod and tell me the live URL.
8. Connect Telegram: open https://<live-url>/api/setup?key=<my WEBHOOK_SECRET> (ask me to type the secret) and confirm the page says Connected.
9. Tell me to send /start to my bot in Telegram, then paste the notes from TEST_NOTES.md one at a time. If anything fails, check the logs with vercel logs and fix it.
