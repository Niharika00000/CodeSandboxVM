# Node runtime image

The MVP runs user code in the stock `node:22-alpine` image (`SANDBOX_IMAGE` in `.env`).
Pull it once so the first Run is fast: `npm run docker:pull`.

Future runtimes (Python, C++) would add a folder here plus a small entry in the runtime registry.

