# swamemflopem

A private one-person questionnaire for Sydney, for T's body-swap video.

- `public/index.html`, `styles.css`, `app.js`: the page. Side A is a wheel she spins to get questions and answers by voice (or typing). Side B is a prompt she hands her ChatGPT.
- `public/questions.js`: every word she reads. Change the questions here.
- `public/results.html`: T's page for listening to and reading what came in. Needs the passcode.
- `api/upload.js`: saves recordings (in slices), typed answers and the ChatGPT paste to a private Vercel Blob store.
- `api/list.js`, `api/file.js`: read them back. Both need the passcode in the `ADMIN_KEY` environment variable.

Recordings are saved as raw audio. Nothing is transcribed in the browser.

## Setup on Vercel

1. Import this repository as a project (framework: Other).
2. Create a **private** Blob store and connect it to the project.
3. Add an environment variable `ADMIN_KEY` with a passcode of your choice.
